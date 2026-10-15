'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const PROJECT_ID = 'prj_0BMpPn1cvL54ectUokSnERZxwNnN';
const MIGRATION_PATH = join(__dirname, '..', 'supabase', 'migrations', '20261014103959_shared_task_assignments.sql');
const MESSAGES = {
  environment: 'Shared assignments migration refused: expected MKT production environment.',
  connection: 'Shared assignments migration refused: a valid production database connection is unavailable.',
  migration: 'Shared assignments migration refused: migration transaction boundaries are invalid.',
  schema: 'Shared assignments migration refused: legacy application schema does not match.',
  verification: 'Shared assignments migration failed verification; deployment stopped.',
  execution: 'Shared assignments migration could not complete; deployment stopped.',
};

class MigrationError extends Error {
  constructor(code) {
    super(MESSAGES[code] || MESSAGES.execution);
    this.name = 'MigrationError';
    this.code = code;
  }
}

function safeError(error) {
  return error instanceof MigrationError ? error : new MigrationError('execution');
}

function productionConnection(env) {
  if (env.VERCEL_PROJECT_ID !== PROJECT_ID || env.VERCEL_ENV !== 'production') throw new MigrationError('environment');
  const value = env.DIRECT_URL || env.DATABASE_URL;
  if (typeof value !== 'string' || !value.trim() || /\[SENSITIVE\]/i.test(value)) throw new MigrationError('connection');
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname || url.pathname === '/') throw new Error();
  } catch {
    throw new MigrationError('connection');
  }
  return value;
}

function migrationBody(sql) {
  const match = /^\s*BEGIN\s*;([\s\S]*)\bCOMMIT\s*;\s*$/i.exec(sql);
  if (!match || /^\s*(?:BEGIN|COMMIT|ROLLBACK)\b/im.test(match[1])) throw new MigrationError('migration');
  return match[1];
}

const LEGACY_COLUMNS = {
  Task: ['id', 'title', 'memberId', 'company', 'meetingId', 'status', 'priority', 'deadline'],
  Content: ['id', 'title', 'memberId', 'company', 'meetingId', 'status', 'type', 'platform', 'publishDate'],
  Meeting: ['id', 'title', 'date', 'attendees', 'agenda', 'notes', 'createdBy'],
  TeamMember: ['id', 'name', 'role', 'company', 'status'],
};

async function legacySchema(client) {
  const { rows } = await client.query(`
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN pg_namespace n ON n.nspname = c.table_schema
    JOIN pg_class t ON t.relnamespace = n.oid AND t.relname = c.table_name
    WHERE c.table_schema = 'public' AND t.relkind = 'r'
      AND c.table_name IN ('Task', 'Content', 'Meeting', 'TeamMember')
  `);
  for (const [table, columns] of Object.entries(LEGACY_COLUMNS)) {
    for (const column of columns) {
      const found = rows.find(row => row.table_name === table && row.column_name === column);
      const dateColumn = ['deadline', 'publishDate', 'date'].includes(column);
      if (!found || !(dateColumn
        ? ['timestamp without time zone', 'timestamp with time zone'].includes(found.data_type)
        : found.data_type === 'text')) throw new MigrationError('schema');
    }
  }
}

async function recordCounts(client) {
  const { rows } = await client.query(`SELECT
    (SELECT count(*)::text FROM public."Task") AS tasks,
    (SELECT count(*)::text FROM public."Content") AS contents`);
  const counts = rows[0];
  if (!counts || !/^\d+$/.test(counts.tasks) || !/^\d+$/.test(counts.contents)) throw new MigrationError('verification');
  return { tasks: String(counts.tasks), contents: String(counts.contents) };
}

async function verifyMigration(client, before) {
  const columns = await client.query(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('Task', 'Content')
      AND column_name IN ('memberIds', 'companies')
  `);
  for (const table of ['Task', 'Content']) {
    for (const column of ['memberIds', 'companies']) {
      const found = columns.rows.find(row => row.table_name === table && row.column_name === column);
      if (!found || found.data_type !== 'ARRAY' || found.udt_name !== '_text' || found.is_nullable !== 'NO'
        || !["'{}'::text[]", 'ARRAY[]::text[]'].includes(found.column_default)) throw new MigrationError('verification');
    }
  }
  const indexes = await client.query(`
    SELECT tab.relname AS table_name, idx.relname AS index_name, am.amname AS method,
      i.indisvalid AS valid, i.indisready AS ready, i.indnkeyatts AS key_count,
      a.attname AS key_column, (i.indpred IS NULL AND i.indexprs IS NULL) AS full_index
    FROM pg_index i
    JOIN pg_class tab ON tab.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tab.relnamespace
    JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_am am ON am.oid = idx.relam
    LEFT JOIN pg_attribute a ON a.attrelid = tab.oid AND a.attnum = i.indkey[0]
    WHERE n.nspname = 'public' AND idx.relname IN ('Task_memberIds_idx', 'Content_memberIds_idx')
  `);
  for (const table of ['Task', 'Content']) {
    const found = indexes.rows.find(row => row.table_name === table && row.index_name === `${table}_memberIds_idx`);
    if (!found || found.method !== 'gin' || !found.valid || !found.ready || Number(found.key_count) !== 1
      || found.key_column !== 'memberIds' || !found.full_index) throw new MigrationError('verification');
  }
  const empty = await client.query(`SELECT (
    (SELECT count(*) FROM public."Task" WHERE
      (cardinality("memberIds") = 0 AND trim("memberId") <> '') OR
      (cardinality("companies") = 0 AND trim("company") <> '')) +
    (SELECT count(*) FROM public."Content" WHERE
      (cardinality("memberIds") = 0 AND trim("memberId") <> '') OR
      (cardinality("companies") = 0 AND trim("company") <> ''))
  )::text AS remaining`);
  if (String(empty.rows[0]?.remaining) !== '0') throw new MigrationError('verification');
  const after = await recordCounts(client);
  if (after.tasks !== before.tasks || after.contents !== before.contents) throw new MigrationError('verification');
  return after;
}

async function applyMigration(client, sql) {
  const body = migrationBody(sql);
  let transaction = false;
  try {
    await client.query('BEGIN');
    transaction = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '120s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
    await legacySchema(client);
    // Stabilize counts and prevent application writes between backfill and verification.
    await client.query('LOCK TABLE public."Task", public."Content" IN ACCESS EXCLUSIVE MODE');
    const before = await recordCounts(client);
    await client.query(body);
    const counts = await verifyMigration(client, before);
    await client.query('COMMIT');
    transaction = false;
    return counts;
  } catch (error) {
    if (transaction) {
      try { await client.query('ROLLBACK'); } catch { /* Never print database errors or connection details. */ }
    }
    throw safeError(error);
  }
}

async function runProductionMigration(options = {}) {
  const env = options.env || process.env;
  const connectionString = productionConnection(env);
  const sql = options.sql || readFileSync(MIGRATION_PATH, 'utf8');
  const createClient = options.createClient || (config => new (require('pg').Client)(config));
  const log = options.log || console.log;
  let client;
  try {
    client = createClient({ connectionString, connectionTimeoutMillis: 15000, application_name: 'mkt-shared-assignments' });
    // Prevent an unexpected socket event from dumping a raw connection error.
    client.on?.('error', () => {});
    await client.connect();
    log('Checking and applying shared assignments migration.');
    const counts = await applyMigration(client, sql);
    log(`Shared assignments verified. Task records: ${counts.tasks}; Content records: ${counts.contents}.`);
    return counts;
  } catch (error) {
    throw safeError(error);
  } finally {
    if (client) {
      try { await client.end(); } catch { /* No credentials or raw errors in build logs. */ }
    }
  }
}

module.exports = { PROJECT_ID, MigrationError, productionConnection, migrationBody, legacySchema, recordCounts, verifyMigration, applyMigration, runProductionMigration };

if (require.main === module) {
  runProductionMigration().catch(error => {
    console.error(safeError(error).message);
    process.exitCode = 1;
  });
}
