import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import type { Prisma } from '@prisma/client';
import { parseSelection, serializeAssignments, matchesMemberSelection, matchesCompanySelection, resolveAssignments } from '../src/lib/assignments';
import { saveMeetingActions } from '../src/lib/meeting-actions';
import ActionItemMultiSelect from '../src/app/meetings/components/ActionItemMultiSelect';
import { renderToStaticMarkup } from 'react-dom/server';

const db = new PGlite();
const migration = readFileSync('supabase/migrations/20261014103959_shared_task_assignments.sql', 'utf8');
type Sql = { query: PGlite['query'] };

// Exercise the actual meeting route and storage helpers against in-memory Postgres.
// The adapter implements the small Prisma surface used by this route; it never connects to production.
function adapter(sql: Sql) {
  const write = async (table: string, data: Record<string, unknown>, id?: string) => {
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);
    if (id && !entries.length) return (await sql.query(`SELECT * FROM "${table}" WHERE id = $1`, [id])).rows[0];
    const values: unknown[] = [];
    const placeholders = entries.map(([key, value]) => {
      values.push(Array.isArray(value) ? JSON.stringify(value)
        : value && ['date', 'deadline', 'publishDate'].includes(key) ? new Date(value as string) : value);
      return key === 'memberIds' || key === 'companies'
        ? `ARRAY(SELECT jsonb_array_elements_text($${values.length}::jsonb))`
        : `$${values.length}`;
    });
    let query: string;
    if (id) {
      values.push(id);
      query = `UPDATE "${table}" SET ${entries.map(([key], i) => `"${key}" = ${placeholders[i]}`).join(', ')} WHERE id = $${values.length} RETURNING *`;
    } else {
      values.push(randomUUID());
      query = `INSERT INTO "${table}" (${entries.map(([key]) => `"${key}"`).join(', ')}, id) VALUES (${placeholders.join(', ')}, $${values.length}) RETURNING *`;
    }
    return (await sql.query(query, values)).rows[0];
  };
  const model = (table: string) => ({
    create: ({ data }: { data: Record<string, unknown> }) => write(table, data),
    update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => write(table, data, where.id),
    findFirst: async ({ where }: { where: { id: string; meetingId: string } }) =>
      (await sql.query(`SELECT * FROM "${table}" WHERE id = $1 AND "meetingId" = $2`, [where.id, where.meetingId])).rows[0] || null,
    updateMany: async ({ where, data }: { where: { meetingId: string; id: { notIn: string[] } }; data: { meetingId: null } }) => {
      assert.deepEqual(data, { meetingId: null });
      const result = await sql.query(
        `UPDATE "${table}" SET "meetingId" = NULL WHERE "meetingId" = $1 AND NOT (id = ANY(SELECT jsonb_array_elements_text($2::jsonb)))`,
        [where.meetingId, JSON.stringify(where.id.notIn)],
      );
      return { count: result.affectedRows ?? 0 };
    },
  });
  return {
    meeting: model('Meeting'), task: model('Task'), content: model('Content'),
    teamMember: {
      findMany: async ({ where }: { where: { id: { in?: string[] } } }) => where.id.in
        ? (await sql.query<{ id: string }>('SELECT id FROM "TeamMember" WHERE id IN (SELECT jsonb_array_elements_text($1::jsonb)) ORDER BY id', [JSON.stringify(where.id.in)])).rows
        : (await sql.query<{ id: string }>('SELECT id FROM "TeamMember" WHERE status <> \'inactive\' ORDER BY id')).rows,
    },
  };
}

const require = createRequire(import.meta.url);
const api: Record<string, (request: Request) => Promise<Response>> = {};
const compiled = ts.transpileModule(readFileSync('src/app/api/meetings/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(compiled, {
  exports: api, console,
  require: (name: string) => {
    if (name === '@/lib/workspace-cache') return { cachedJsonRead: (_key: string[], read: () => Promise<Response>) => read(), invalidateWorkspace: () => {} };
      if (name === '@/lib/request-body') return require('../src/lib/request-body.ts');
      if (name === '@/lib/rich-text') return require('../src/lib/rich-text.ts');
      if (name === '@/lib/integration-security') return require('../src/lib/integration-security.ts');
      if (name === 'next/server') return require('next/server');
    if (name === '@/lib/assignments') return require('../src/lib/assignments.ts');
    if (name === '@/lib/meeting-actions') return { saveMeetingActions };
    if (name === '@/lib/prisma') return { prisma: { $transaction: (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => db.transaction(sql => callback(adapter(sql) as unknown as Prisma.TransactionClient)) } };
    throw new Error(`Unexpected import ${name}`);
  },
});

before(async () => {
  await db.exec(`
    CREATE TABLE "TeamMember" (id text PRIMARY KEY, status text NOT NULL DEFAULT 'active');
    INSERT INTO "TeamMember" (id) VALUES ('oil'), ('taw');
    CREATE TABLE "Meeting" (id text PRIMARY KEY, title text, date timestamptz, time text, company text, status text, attendees text, agenda text, notes text, "createdBy" text);
    CREATE TABLE "Task" (id text PRIMARY KEY, title text, "memberId" text REFERENCES "TeamMember"(id), company text, "meetingId" text, deadline timestamptz, status text, priority text);
    CREATE TABLE "Content" (id text PRIMARY KEY, title text, "memberId" text REFERENCES "TeamMember"(id), company text, "meetingId" text, "publishDate" timestamptz, status text, platform text, type text, link text);
    INSERT INTO "Task" (id, title, "memberId", company, status) VALUES ('legacy', 'Existing task', 'oil', 'GFS', 'done');
    INSERT INTO "Content" (id, title, "memberId", company, status) VALUES ('legacy', 'Existing content', 'taw', 'MHL', 'published');
  `);
  await db.exec(migration);
});
after(() => db.close());

const request = (method: string, body: unknown) => new Request('http://localhost/api/meetings', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const action = { title: 'Shared follow-up', itemCategory: 'task', companies: ['GFS', 'MHL'], memberIds: ['oil', 'taw'], deadline: '2026-10-20' };

test('migration preserves legacy records and backfills their selections', async () => {
  const task = (await db.query<{ memberId: string; memberIds: string[]; companies: string[]; status: string }>('SELECT * FROM "Task" WHERE id = \'legacy\'')).rows[0];
  assert.equal(task.status, 'done');
  assert.deepEqual(task.memberIds, ['oil']);
  assert.deepEqual(task.companies, ['GFS']);
  assert.equal(serializeAssignments({ ...task, company: 'GFS' }).memberId, 'oil');
});

test('two companies and two assignees create one task and reopen with all selections', async () => {
  const response = await api.POST(request('POST', { title: 'Shared meeting', date: '2026-10-14', items: [action] }));
  assert.equal(response.status, 200);
  const meetingId = (await response.json()).meeting.id;
  const tasks = (await db.query<{ memberId: string; company: string; memberIds: string[]; companies: string[] }>('SELECT * FROM "Task" WHERE "meetingId" = $1', [meetingId])).rows;
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].memberId, 'oil');
  assert.deepEqual(tasks[0].memberIds, ['oil', 'taw']);
  assert.deepEqual(tasks[0].companies, ['GFS', 'MHL']);
  const reopened = serializeAssignments(tasks[0]);
  assert.equal(reopened.memberId, 'oil,taw');
  assert.equal(reopened.company, 'GFS,MHL');
  assert.equal(matchesMemberSelection(reopened.memberId, 'taw'), true);
  assert.equal(matchesCompanySelection(reopened.company, 'MHL'), true);
  await db.exec(migration);
  assert.deepEqual((await db.query<{ memberIds: string[] }>('SELECT "memberIds" FROM "Task" WHERE "meetingId" = $1', [meetingId])).rows[0].memberIds, ['oil', 'taw']);
});

test('editing shared content updates one record and preserves its completion and link', async () => {
  const response = await api.POST(request('POST', { title: 'Content meeting', date: '2026-10-14', items: [{ ...action, itemCategory: 'content' }] }));
  const meetingId = (await response.json()).meeting.id;
  const content = (await db.query<{ id: string }>('SELECT id FROM "Content" WHERE "meetingId" = $1', [meetingId])).rows[0];
  await db.query('UPDATE "Content" SET status = \'published\', link = \'https://example.com/post\' WHERE id = $1', [content.id]);
  const edited = await api.PUT(request('PUT', { id: meetingId, items: [{ ...action, id: content.id, itemCategory: 'content', companies: ['CAR', 'MHL'], memberIds: ['taw'] }] }));
  assert.equal(edited.status, 200);
  const rows = (await db.query<{ status: string; link: string; memberIds: string[]; companies: string[] }>('SELECT * FROM "Content" WHERE "meetingId" = $1', [meetingId])).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'published');
  assert.equal(rows[0].link, 'https://example.com/post');
  assert.deepEqual(rows[0].memberIds, ['taw']);
  assert.deepEqual(rows[0].companies, ['CAR', 'MHL']);
});

test('editing a shared task preserves its done status and priority without creating another task', async () => {
  const response = await api.POST(request('POST', { title: 'Task meeting', date: '2026-10-14', items: [action] }));
  const meetingId = (await response.json()).meeting.id;
  const task = (await db.query<{ id: string }>('SELECT id FROM "Task" WHERE "meetingId" = $1', [meetingId])).rows[0];
  await db.query('UPDATE "Task" SET status = \'done\', priority = \'high\' WHERE id = $1', [task.id]);
  const response2 = await api.PUT(request('PUT', { id: meetingId, items: [{ ...action, id: task.id, memberIds: ['taw'], companies: ['CAR'] }] }));
  assert.equal(response2.status, 200);
  const tasks = (await db.query<{ status: string; priority: string; memberIds: string[]; companies: string[] }>('SELECT * FROM "Task" WHERE "meetingId" = $1', [meetingId])).rows;
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].status, 'done');
  assert.equal(tasks[0].priority, 'high');
  assert.deepEqual(tasks[0].memberIds, ['taw']);
});

test('removing an action from a meeting keeps the task and content on the board, only detached', async () => {
  const response = await api.POST(request('POST', { title: 'Detach meeting', date: '2026-10-14', items: [
    { ...action, title: 'Keep task' }, { ...action, title: 'Drop task' }, { ...action, title: 'Drop content', itemCategory: 'content' },
  ] }));
  const meetingId = (await response.json()).meeting.id;
  const tasks = (await db.query<{ id: string; title: string }>('SELECT id, title FROM "Task" WHERE "meetingId" = $1', [meetingId])).rows;
  const keep = tasks.find(task => task.title === 'Keep task')!;
  const drop = tasks.find(task => task.title === 'Drop task')!;
  const content = (await db.query<{ id: string }>('SELECT id FROM "Content" WHERE "meetingId" = $1', [meetingId])).rows[0];
  await db.query('UPDATE "Task" SET status = \'done\' WHERE id = $1', [drop.id]);
  await db.query('UPDATE "Content" SET link = \'https://example.com/kept\' WHERE id = $1', [content.id]);

  const edited = await api.PUT(request('PUT', { id: meetingId, items: [
    { ...action, id: keep.id, title: 'Keep task' }, { ...action, title: 'New task' },
  ] }));
  assert.equal(edited.status, 200);
  const linked = (await db.query<{ title: string }>('SELECT title FROM "Task" WHERE "meetingId" = $1 ORDER BY title', [meetingId])).rows;
  assert.deepEqual(linked.map(row => row.title), ['Keep task', 'New task']);
  const dropped = (await db.query<{ status: string; meetingId: string | null }>('SELECT status, "meetingId" FROM "Task" WHERE id = $1', [drop.id])).rows[0];
  assert.equal(dropped.status, 'done');
  assert.equal(dropped.meetingId, null);
  const keptContent = (await db.query<{ link: string; meetingId: string | null }>('SELECT link, "meetingId" FROM "Content" WHERE id = $1', [content.id])).rows[0];
  assert.equal(keptContent.link, 'https://example.com/kept');
  assert.equal(keptContent.meetingId, null);

  const untouched = await api.PUT(request('PUT', { id: meetingId, title: 'Renamed only' }));
  assert.equal(untouched.status, 200);
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "Task" WHERE "meetingId" = $1', [meetingId])).rows[0].count, 2);
});

test('a meeting cannot overwrite an action belonging to another meeting', async () => {
  const created = await api.POST(request('POST', { title: 'New meeting', date: '2026-10-14', items: [] }));
  const id = (await created.json()).meeting.id;
  const rejected = await api.PUT(request('PUT', { id, items: [{ ...action, id: 'legacy' }] }));
  assert.equal(rejected.status, 400);
  assert.equal((await db.query<{ title: string }>('SELECT title FROM "Task" WHERE id = \'legacy\'')).rows[0].title, 'Existing task');
});

test('an invalid assignee rolls back both the meeting and all its new actions', async () => {
  const count = (await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "Meeting"')).rows[0].count;
  const response = await api.POST(request('POST', { title: 'Invalid meeting', date: '2026-10-14', items: [action, { ...action, memberIds: ['missing'] }] }));
  assert.equal(response.status, 400);
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "Meeting"')).rows[0].count, count);
});

test('legacy updates and status-only updates keep shared assignments intact', async () => {
  assert.deepEqual(await resolveAssignments({ status: 'done' } as {}, async () => []), {});
  const result = await resolveAssignments({ memberId: 'oil,taw,oil', company: 'GFS,MHL' }, async () => [{ id: 'oil' }, { id: 'taw' }]);
  assert.equal(result.memberId, 'oil');
  assert.deepEqual(result.memberIds, ['oil', 'taw']);
  assert.deepEqual(result.companies, ['GFS', 'MHL']);
  assert.equal(matchesMemberSelection('oil-other', 'oil'), false);
  assert.deepEqual(await resolveAssignments({ company: '' }, async () => []), { company: '', companies: [] });
});

test('everyone uses one valid foreign key and still includes every responsible person', async () => {
  const result = await resolveAssignments({ memberIds: ['all', 'oil'], companies: ['GFS'] }, async () => [{ id: 'oil' }, { id: 'taw' }], true);
  assert.equal(result.memberId, 'oil');
  assert.deepEqual(result.memberIds, ['all']);
  assert.equal(matchesMemberSelection(result.memberIds, 'taw'), true);
});

test('the multi-select controls retain multiple checkboxes and can remove a selection', () => {
  let next: string[] = [];
  const control = ActionItemMultiSelect({ label: 'บริษัท', options: ['GFS', 'MHL', 'CAR'].map(value => ({ value, label: value })), value: ['GFS', 'MHL'], onChange: value => { next = value; } });
  const markup = renderToStaticMarkup(control);
  assert.equal((markup.match(/checked=""/g) || []).length, 2);
  const labels = control.props.children[1].props.children;
  labels[0].props.children[0].props.onChange();
  assert.deepEqual(next, ['MHL']);
  labels[2].props.children[0].props.onChange();
  assert.deepEqual(next, ['GFS', 'MHL', 'CAR']);
  assert.deepEqual(parseSelection('GFS, GFS, MHL'), ['GFS', 'MHL']);
  const owners = ActionItemMultiSelect({ label: 'ผู้รับผิดชอบ', options: [{ value: 'all', label: 'ทุกคน' }, { value: 'oil', label: 'OIL' }], value: ['all'], exclusiveValue: 'all', onChange: value => { next = value; } });
  owners.props.children[1].props.children[1].props.children[0].props.onChange();
  assert.deepEqual(next, ['oil']);
});
