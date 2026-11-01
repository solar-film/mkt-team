import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonRequest, loadSource } from './route-harness';

/** In-memory Prisma for /api/work-review: one content and its D+7 row (if any). */
function fakePrisma(metric: { reach: number | null; source: string; note?: string | null } | null) {
  const state = { metric: metric && { note: null, ...metric }, writes: [] as string[] };
  const content = { id: 'c1', submittedAt: null, waitingOn: null, firstReview: null, reviseReason: null, promotion: null };
  const pick = () => state.metric && { reach: state.metric.reach, source: state.metric.source };
  const prisma: any = {
    content: { update: async ({ data }: any) => ({ ...content, ...data }) },
    task: { update: async () => content },
    contentMetric: {
      findUnique: async () => pick(),
      update: async ({ data }: any) => { state.writes.push('update'); state.metric = { ...state.metric!, ...data }; return pick(); },
      create: async ({ data }: any) => { state.writes.push('create'); state.metric = { note: null, ...data }; return pick(); },
    },
  };
  prisma.$transaction = (work: (tx: any) => Promise<unknown>) => work(prisma);
  return { prisma, state };
}

const route = (prisma: any) => loadSource('src/app/api/work-review/route.ts', { '@/lib/prisma': { prisma } });
const put = (prisma: any, body: Record<string, unknown>) => {
  const request = jsonRequest('/api/work-review', 'PUT', { kind: 'content', id: 'c1', ...body });
  request.headers.set('x-mkt-member-id', 'm1');
  return route(prisma).PUT(request);
};

test('typing Reach @7 วัน creates the D+7 row as manual, by the signed-in member', async () => {
  const { prisma, state } = fakePrisma(null);
  const response = await put(prisma, { reach7: '1,250' });
  assert.equal(response.status, 200);
  assert.deepEqual(state.writes, ['create']);
  assert.equal(state.metric!.reach, 1250);
  assert.equal(state.metric!.source, 'manual');
  assert.equal((state.metric as any).recordedById, 'm1');
  const body = await response.json();
  assert.equal(body.reach7, 1250);
  assert.equal(body.reach7Source, 'manual');
});

test('correcting a Windsor reach makes it manual and drops the automatic note', async () => {
  const { prisma, state } = fakePrisma({ reach: 900, source: 'windsor', note: 'ดึงอัตโนมัติ' });
  await put(prisma, { reach7: 1000 });
  assert.equal(state.metric!.reach, 1000);
  assert.equal(state.metric!.source, 'manual');
  assert.equal(state.metric!.note, null);
});

test('a manual note is kept when the number changes', async () => {
  const { prisma, state } = fakePrisma({ reach: 5, source: 'manual', note: 'ของทีม' });
  await put(prisma, { reach7: 6 });
  assert.equal(state.metric!.note, 'ของทีม');
});

test('no reach sent, same reach, or clearing a missing row writes nothing', async () => {
  for (const [metric, body] of [
    [{ reach: 900, source: 'windsor' }, {}],
    [{ reach: 900, source: 'windsor' }, { reach7: 900 }],
    [null, { reach7: '' }],
  ] as const) {
    const { prisma, state } = fakePrisma(metric && { ...metric });
    const response = await put(prisma, { promotion: 'organic', ...body });
    assert.equal(response.status, 200);
    assert.deepEqual(state.writes, [], JSON.stringify(body));
  }
});

test('clearing an existing reach keeps the row and empties the number', async () => {
  const { prisma, state } = fakePrisma({ reach: 900, source: 'manual' });
  const body = await (await put(prisma, { reach7: '' })).json();
  assert.equal(state.metric!.reach, null);
  assert.equal(body.reach7, null);
  assert.equal(body.reach7Source, null);
});

test('bad reach is refused before anything is saved; tasks ignore reach', async () => {
  const { prisma, state } = fakePrisma(null);
  assert.equal((await put(prisma, { reach7: '-3' })).status, 400);
  assert.deepEqual(state.writes, []);
  const task = await route(prisma).PUT(jsonRequest('/api/work-review', 'PUT', { kind: 'task', id: 't1', reach7: 50 }));
  assert.equal(task.status, 200);
  assert.deepEqual(state.writes, []);
});

test('GET returns the stored reach and where it came from', async () => {
  const { prisma } = fakePrisma({ reach: 140, source: 'windsor' });
  const response = await route(prisma).GET(new Request('http://localhost/api/work-review?id=c1'));
  assert.deepEqual(await response.json(), { reach7: 140, reach7Source: 'windsor' });
  assert.equal((await route(prisma).GET(new Request('http://localhost/api/work-review'))).status, 400);
});
