'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const { PROJECT_ID, productionConnection, applyMigration, runProductionMigration } = require('../scripts/apply-shared-assignments.cjs');

const migration = readFileSync(join(__dirname, '..', 'supabase/migrations/20261014103959_shared_task_assignments.sql'), 'utf8');
const environment = { VERCEL_PROJECT_ID: PROJECT_ID, VERCEL_ENV: 'production', DATABASE_URL: 'postgresql://test-user:test-password@db.invalid/mkt_test' };

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE public."TeamMember" (id text PRIMARY KEY, name text, role text, company text, status text);
    CREATE TABLE public."Meeting" (id text PRIMARY KEY, title text, date timestamp, attendees text, agenda text, notes text, "createdBy" text);
    CREATE TABLE public."Task" (id text PRIMARY KEY, title text, "memberId" text, company text, "meetingId" text, status text, priority text, deadline timestamp);
    CREATE TABLE public."Content" (id text PRIMARY KEY, title text, "memberId" text, company text, "meetingId" text, status text, type text, platform text, "publishDate" timestamp);
    INSERT INTO public."Task" (id, title, "memberId", company, status, priority) VALUES ('task', 'Existing task', 'oil', 'GFS,MHL', 'done', 'high');
    INSERT INTO public."Content" (id, title, "memberId", company, status) VALUES ('content', 'Existing content', 'taw', 'CAR', 'published');
  `);
  return db;
}

function adapter(db) {
  const queries = [];
  return {
    queries,
    async query(sql) {
      queries.push(sql);
      if (/^\s*SELECT\b/i.test(sql)) return db.query(sql);
      await db.exec(sql);
      return { rows: [] };
    },
  };
}

async function arrayColumns(db) {
  return (await db.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('Task', 'Content') AND column_name IN ('memberIds', 'companies')`)).rows;
}

test('only the exact Vercel production project accepts a real-looking connection, preferring DIRECT_URL', () => {
  const direct = 'postgresql://direct-user:direct-password@direct.invalid/mkt_test';
  assert.equal(productionConnection(environment), environment.DATABASE_URL);
  assert.equal(productionConnection({ ...environment, DIRECT_URL: direct }), direct);
  for (const env of [
    {}, { ...environment, VERCEL_PROJECT_ID: 'another-project' }, { ...environment, VERCEL_ENV: 'preview' },
    { ...environment, DATABASE_URL: '' }, { ...environment, DATABASE_URL: '[SENSITIVE]' },
    { ...environment, DIRECT_URL: '[SENSITIVE]' }, { ...environment, DATABASE_URL: 'not-a-url' },
  ]) assert.throws(() => productionConnection(env), error => !error.message.includes('password') && /^Shared assignments migration refused:/.test(error.message));
});

test('wrong environment refuses before reading or opening a database connection', async () => {
  let connected = false;
  await assert.rejects(runProductionMigration({ env: { ...environment, VERCEL_ENV: 'preview' }, createClient: () => { connected = true; } }), { code: 'environment' });
  assert.equal(connected, false);
});

test('a different CRM schema is rejected by reads before any lock or migration write', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE public.crm_customers (id text)');
    const client = adapter(db);
    await assert.rejects(applyMigration(client, migration), { code: 'schema' });
    assert.equal(client.queries.some(sql => /^\s*(ALTER|UPDATE|CREATE|LOCK)\b/i.test(sql)), false);
    assert.equal(client.queries.at(-1), 'ROLLBACK');
    assert.equal((await arrayColumns(db)).length, 0);
  } finally { await db.close(); }
});

test('the existing SQL backfills safely, verifies indexes/counts and can run twice', async () => {
  const db = await fixture();
  try {
    const client = adapter(db);
    assert.deepEqual(await applyMigration(client, migration), { tasks: '1', contents: '1' });
    const task = (await db.query('SELECT * FROM public."Task"')).rows[0];
    assert.deepEqual(task.memberIds, ['oil']);
    assert.deepEqual(task.companies, ['GFS', 'MHL']);
    assert.equal(task.status, 'done');
    assert.equal(task.priority, 'high');
    assert.equal(task.memberId, 'oil');
    assert.equal(task.company, 'GFS,MHL');
    assert.equal((await arrayColumns(db)).length, 4);
    assert.deepEqual(await applyMigration(client, migration), { tasks: '1', contents: '1' });
    assert.ok(client.queries.includes("SET LOCAL lock_timeout = '5s'"));
    assert.ok(client.queries.includes("SET LOCAL statement_timeout = '120s'"));
    assert.ok(client.queries.findIndex(sql => sql.includes('information_schema.columns')) < client.queries.findIndex(sql => /^\s*ALTER/.test(sql)));
    assert.equal(client.queries.at(-1), 'COMMIT');
  } finally { await db.close(); }
});

test('a SQL execution failure rolls back added columns and preserves existing records', async () => {
  const db = await fixture();
  try {
    const client = adapter(db);
    const broken = migration.replace('COMMIT;', 'SELECT missing_migration_function();\nCOMMIT;');
    await assert.rejects(applyMigration(client, broken), { code: 'execution' });
    assert.equal(client.queries.at(-1), 'ROLLBACK');
    assert.equal((await arrayColumns(db)).length, 0);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public."Task"')).rows[0].count, 1);
  } finally { await db.close(); }
});

test('an existing incorrectly defined index makes verification roll back the migration', async () => {
  const db = await fixture();
  try {
    await db.exec('CREATE INDEX "Task_memberIds_idx" ON public."Task" ("memberId")');
    const client = adapter(db);
    await assert.rejects(applyMigration(client, migration), { code: 'verification' });
    assert.equal(client.queries.at(-1), 'ROLLBACK');
    assert.equal((await arrayColumns(db)).length, 0);
  } finally { await db.close(); }
});

test('incomplete backfill is rejected and rolled back before commit', async () => {
  const db = await fixture();
  try {
    const client = adapter(db);
    const incomplete = migration.replace('COMMIT;', `UPDATE public."Task" SET "memberIds" = '{}';\nCOMMIT;`);
    await assert.rejects(applyMigration(client, incomplete), { code: 'verification' });
    assert.equal(client.queries.at(-1), 'ROLLBACK');
    assert.equal((await arrayColumns(db)).length, 0);
  } finally { await db.close(); }
});

test('a changed record count is rejected and rolled back before commit', async () => {
  const db = await fixture();
  try {
    const client = adapter(db);
    const changed = migration.replace('COMMIT;', `INSERT INTO public."Task" (id, "memberId", company, "memberIds", companies)
      VALUES ('extra', 'oil', 'GFS', ARRAY['oil'], ARRAY['GFS']);\nCOMMIT;`);
    await assert.rejects(applyMigration(client, changed), { code: 'verification' });
    assert.equal(client.queries.at(-1), 'ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public."Task"')).rows[0].count, 1);
    assert.equal((await arrayColumns(db)).length, 0);
  } finally { await db.close(); }
});

test('connection failures expose only generic status and close the mocked client', async () => {
  const logs = [];
  let ended = false;
  const rawError = new Error(`Connection failed for ${environment.DATABASE_URL}`);
  await assert.rejects(runProductionMigration({
    env: environment, sql: migration, log: message => logs.push(message),
    createClient: () => ({ on() {}, connect: async () => { throw rawError; }, end: async () => { ended = true; } }),
  }), error => error.code === 'execution' && !error.message.includes('test-password') && !error.message.includes('db.invalid'));
  assert.equal(ended, true);
  assert.equal(logs.some(log => /postgres|password|db\.invalid/.test(log)), false);
});

test('successful production wrapper logs status and numeric record counts only', async () => {
  const db = await fixture();
  try {
    const client = adapter(db);
    const logs = [];
    let ended = false;
    const counts = await runProductionMigration({
      env: environment, sql: migration, log: message => logs.push(message),
      createClient: () => ({ ...client, connect: async () => {}, end: async () => { ended = true; } }),
    });
    assert.deepEqual(counts, { tasks: '1', contents: '1' });
    assert.equal(ended, true);
    assert.deepEqual(logs, ['Checking and applying shared assignments migration.', 'Shared assignments verified. Task records: 1; Content records: 1.']);
  } finally { await db.close(); }
});
