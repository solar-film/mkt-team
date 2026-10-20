import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsonRequest, loadSource } from './route-harness';
import { blocksCompletion, missingCompletionLink, requiresLinkToComplete } from '../src/lib/completion-link';

test('content always needs a link to complete; tasks only when linked to a KPI', () => {
  assert.equal(requiresLinkToComplete('content', null), true);
  assert.equal(requiresLinkToComplete('task', null), false);
  assert.equal(requiresLinkToComplete('task', ''), false);
  assert.equal(requiresLinkToComplete('task', 'kpi-1'), true);
  assert.equal(requiresLinkToComplete('task', 'kpi-1,kpi-2'), true);
  assert.equal(missingCompletionLink('task', { status: 'done', kpiId: 'kpi-1', link: '  ' }), true);
  assert.equal(missingCompletionLink('task', { status: 'done', kpiId: null, link: null }), false);
  assert.equal(missingCompletionLink('content', { status: 'published', kpiId: null, link: null }), true);
  assert.equal(missingCompletionLink('content', { status: 'todo', kpiId: 'kpi-1', link: null }), false);
});

test('records already completed without a link stay editable; new violations are refused', () => {
  const legacy = { status: 'done', kpiId: 'kpi-1', link: null };
  assert.equal(blocksCompletion('task', legacy, { ...legacy, link: '' }), false);
  assert.equal(blocksCompletion('task', { status: 'todo', kpiId: 'kpi-1', link: null }, legacy), true);
  assert.equal(blocksCompletion('task', { status: 'done', kpiId: null, link: null }, legacy), true); // adding a KPI to linkless done work
  assert.equal(blocksCompletion('task', null, { status: 'done', kpiId: 'kpi-1', link: 'https://example.com' }), false);
});

// Fixture Prisma: no database or credentials are used.
function fakePrisma(records: Record<string, any>) {
  const calls: string[] = [];
  const model = (name: string) => ({
    findUnique: async ({ where }: any) => (records[where.id] ? { ...records[where.id] } : null),
    create: async ({ data }: any) => { calls.push(`${name}.create`); return { id: 'new', ...data, member: { id: 'oil', name: 'OIL' } }; },
    update: async ({ where, data }: any) => {
      calls.push(`${name}.update`);
      return { ...records[where.id], ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)), id: where.id, member: { id: 'oil', name: 'OIL' } };
    },
  });
  return {
    calls,
    prisma: { task: model('task'), content: model('content'), teamMember: { findMany: async () => [{ id: 'oil', name: 'OIL' }] } },
  };
}

const route = (path: string, prisma: any) => loadSource(path, { '@/lib/prisma': { prisma } });
const message = async (response: Response) => (await response.json()).error;

test('task API refuses to complete KPI work without a link and allows everything else', async () => {
  const fixture = fakePrisma({
    open: { status: 'todo', kpiId: 'kpi-1', link: null },
    plain: { status: 'todo', kpiId: null, link: null },
    legacy: { status: 'done', kpiId: 'kpi-1', link: null },
  });
  const tasks = route('src/app/api/tasks/route.ts', fixture.prisma);

  const refused = await tasks.PUT(jsonRequest('/api/tasks', 'PUT', { id: 'open', status: 'done' }));
  assert.equal(refused.status, 400);
  assert.match(await message(refused), /ต้องใส่ลิงก์ผลงาน/);
  assert.deepEqual(fixture.calls, []);

  assert.equal((await tasks.PUT(jsonRequest('/api/tasks', 'PUT', { id: 'open', status: 'done', link: 'https://example.com/shoot' }))).status, 200);
  assert.equal((await tasks.PUT(jsonRequest('/api/tasks', 'PUT', { id: 'plain', status: 'done' }))).status, 200);
  // Editing a task completed before this rule keeps working.
  assert.equal((await tasks.PUT(jsonRequest('/api/tasks', 'PUT', { id: 'legacy', title: 'Renamed', kpiId: 'kpi-1', link: '' }))).status, 200);

  const created = await tasks.POST(jsonRequest('/api/tasks', 'POST', { title: 'Shoot', status: 'done', kpiId: 'kpi-1', memberIds: ['oil'], companies: ['GFS'] }));
  assert.equal(created.status, 400);
  assert.equal(fixture.calls.filter(call => call === 'task.create').length, 0);
});

test('content API keeps requiring a link for every completed content item', async () => {
  const fixture = fakePrisma({
    draft: { status: 'todo', kpiId: null, link: null },
    legacy: { status: 'done', kpiId: null, link: null },
  });
  const content = route('src/app/api/content/route.ts', fixture.prisma);
  assert.equal((await content.PUT(jsonRequest('/api/content', 'PUT', { id: 'draft', status: 'done' }))).status, 400);
  assert.equal((await content.PUT(jsonRequest('/api/content', 'PUT', { id: 'draft', status: 'published' }))).status, 400);
  assert.equal((await content.PUT(jsonRequest('/api/content', 'PUT', { id: 'draft', status: 'done', link: 'https://facebook.com/post/1' }))).status, 200);
  assert.equal((await content.PUT(jsonRequest('/api/content', 'PUT', { id: 'legacy', title: 'Renamed' }))).status, 200);
  assert.equal((await content.PUT(jsonRequest('/api/content', 'PUT', { id: 'draft', status: 'in_progress' }))).status, 200);
});
