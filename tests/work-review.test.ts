import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonRequest, loadSource } from './route-harness';

/** /api/work-review with one stored content; records what reaches the database. */
function reviewRoute() {
  const updates: Record<string, unknown>[] = [];
  const prisma: any = {
    content: { update: async ({ data }: any) => { updates.push(data); return { id: 'c1', promotion: data.promotion ?? null }; } },
    contentMetric: { findUnique: async () => null },
  };
  prisma.$transaction = (work: (tx: any) => Promise<unknown>) => work(prisma);
  const put = (body: Record<string, unknown>) =>
    loadSource('src/app/api/work-review/route.ts', { '@/lib/prisma': { prisma } }).PUT(jsonRequest('/api/work-review', 'PUT', { id: 'c1', ...body }));
  return { updates, put };
}

test('Organic/Paid is saved for content from the รายงานรวม page', async () => {
  const { updates, put } = reviewRoute();
  const response = await put({ kind: 'content', promotion: 'paid' });
  assert.equal(response.status, 200);
  assert.deepEqual(updates, [{ promotion: 'paid' }]);
  assert.equal((await response.json()).promotion, 'paid');
});

test('hand-in time, first review and waiting cannot be set by a request any more', async () => {
  const { updates, put } = reviewRoute();
  const response = await put({ kind: 'content', submittedAt: '2026-11-01T12:00:00+07:00', firstReview: 'pass', reviseReason: 'brief', waitingOn: 'รอรูป' });
  assert.equal(response.status, 200);
  assert.deepEqual(updates, [{}]);
});

test('tasks and unknown kinds are refused', async () => {
  const { updates, put } = reviewRoute();
  assert.equal((await put({ kind: 'task', promotion: 'paid' })).status, 400);
  assert.equal((await put({ promotion: 'paid' })).status, 400);
  assert.deepEqual(updates, []);
});
