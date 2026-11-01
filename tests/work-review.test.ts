import assert from 'node:assert/strict';
import test from 'node:test';
import { changesFirstReview, parseWorkReview } from '../src/lib/work-review';
import { jsonRequest, loadSource } from './route-harness';

const stored = { firstReview: 'revise', reviseReason: 'quality' };

test('resending the stored first review is not a change (non-Admin can still save other fields)', () => {
  const update = parseWorkReview({ firstReview: 'revise', reviseReason: 'quality', waitingOn: 'รอรูป' }, 'task');
  assert.equal(changesFirstReview(stored, update), false);
  assert.equal(changesFirstReview(stored, parseWorkReview({ waitingOn: 'รอรูป' }, 'task')), false);
});

test('changing the result or the reason is a change that needs the Admin', () => {
  assert.equal(changesFirstReview(stored, parseWorkReview({ firstReview: 'pass' }, 'task')), true);
  assert.equal(changesFirstReview(stored, parseWorkReview({ firstReview: 'revise', reviseReason: 'brief' }, 'task')), true);
  assert.equal(changesFirstReview(stored, parseWorkReview({ firstReview: '' }, 'content')), true);
  assert.equal(changesFirstReview({ firstReview: null, reviseReason: null }, parseWorkReview({ firstReview: 'pass' }, 'task')), true);
});

/** /api/work-review with one stored task and the signed-in member's role. */
function reviewRoute(role: string | null) {
  const task = { id: 't1', submittedAt: null, waitingOn: null, firstReview: null as string | null, reviseReason: null as string | null };
  const prisma: any = {
    task: {
      findUnique: async () => ({ firstReview: task.firstReview, reviseReason: task.reviseReason }),
      update: async ({ data }: any) => Object.assign(task, data),
    },
    content: { findUnique: async () => null },
    teamMember: { findUnique: async () => (role ? { role } : null) },
  };
  const put = (body: Record<string, unknown>) => {
    const request = jsonRequest('/api/work-review', 'PUT', { kind: 'task', id: 't1', ...body });
    request.headers.set('x-mkt-member-id', 'm1');
    return loadSource('src/app/api/work-review/route.ts', { '@/lib/prisma': { prisma } }).PUT(request);
  };
  return { task, put };
}

test('only the Admin can set the first review result', async () => {
  const member = reviewRoute('Member');
  const refused = await member.put({ firstReview: 'pass' });
  assert.equal(refused.status, 403);
  assert.equal(member.task.firstReview, null);
  // Other fields still save when the review is not touched
  assert.equal((await member.put({ waitingOn: 'รอรูป', firstReview: '' })).status, 200);
  assert.equal(member.task.waitingOn, 'รอรูป');

  const admin = reviewRoute('Admin');
  assert.equal((await admin.put({ firstReview: 'revise', reviseReason: 'brief' })).status, 200);
  assert.equal(admin.task.firstReview, 'revise');
  assert.equal(admin.task.reviseReason, 'brief');
});
