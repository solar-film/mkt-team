import assert from 'node:assert/strict';
import test from 'node:test';
import { AiReviewInputError, parseAiReviews } from '../src/lib/ai-review';
import { jsonRequest, loadSource } from './route-harness';

test('AI review uploads need kind, id, pass/revise and a reason', () => {
  const parsed = parseAiReviews({ reviews: [{ kind: 'task', id: 't1', suggestion: 'revise', note: ' คำผิด 2 จุด ' }] });
  assert.deepEqual(parsed, [{ kind: 'task', id: 't1', suggestion: 'revise', note: 'คำผิด 2 จุด' }]);
  assert.throws(() => parseAiReviews({ reviews: [] }), AiReviewInputError);
  assert.throws(() => parseAiReviews({ reviews: [{ kind: 'idea', id: 'x', suggestion: 'pass', note: 'ok' }] }), AiReviewInputError);
  assert.throws(() => parseAiReviews({ reviews: [{ kind: 'task', id: 't1', suggestion: 'approve', note: 'ok' }] }), AiReviewInputError);
  assert.throws(() => parseAiReviews({ reviews: [{ kind: 'task', id: 't1', suggestion: 'pass', note: '' }] }), AiReviewInputError);
  assert.throws(() => parseAiReviews({ reviews: [
    { kind: 'task', id: 't1', suggestion: 'pass', note: 'a' },
    { kind: 'task', id: 't1', suggestion: 'pass', note: 'b' },
  ] }), AiReviewInputError);
});

function aiRoute() {
  const writes: { kind: string; where: any; data: any }[] = [];
  const updateMany = (kind: string) => async ({ where, data }: any) => {
    writes.push({ kind, where, data });
    return { count: where.id === 'missing' ? 0 : 1 };
  };
  const prisma: any = {
    task: { updateMany: updateMany('task'), findMany: async () => [] },
    content: { updateMany: updateMany('content'), findMany: async () => [] },
  };
  prisma.$transaction = (ops: Promise<unknown>[]) => Promise.all(ops);
  const route = loadSource('src/app/api/kpi-hub/ai-reviews/route.ts', { '@/lib/prisma': { prisma } }, {
    process: { env: { KPI_EVALUATION_TOKEN: 'secret-token' } },
  });
  const call = (method: 'GET' | 'POST', token: string | null, body?: Record<string, unknown>) => {
    const request = jsonRequest('/api/kpi-hub/ai-reviews', method, body);
    if (token) request.headers.set('authorization', `Bearer ${token}`);
    return route[method](request);
  };
  return { writes, call };
}

test('AI review route needs the token and only stores the suggestion, never firstReview', async () => {
  const { writes, call } = aiRoute();
  assert.equal((await call('GET', null)).status, 401);
  assert.equal((await call('POST', 'wrong', { reviews: [] })).status, 401);

  const queue = await call('GET', 'secret-token');
  assert.equal(queue.status, 200);
  assert.ok((await queue.json()).criteria.length >= 4);

  const response = await call('POST', 'secret-token', { reviews: [
    { kind: 'content', id: 'c1', suggestion: 'pass', note: 'ตรงบรีฟ' },
    { kind: 'task', id: 'missing', suggestion: 'revise', note: 'ลิงก์เปิดไม่ได้' },
  ] });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { saved: 1, notFound: ['task:missing'] });
  assert.equal(writes.length, 2);
  for (const write of writes) {
    assert.deepEqual(Object.keys(write.data).sort(), ['aiReview', 'aiReviewNote', 'aiReviewedAt']);
  }
});
