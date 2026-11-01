import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monthQueryRange, percent, summarizeMonth, type ReviewItem } from '../src/lib/kpi-summary';
import { parseWorkReview, submittedAtForStatus, WorkReviewError } from '../src/lib/work-review';
import { EvaluationInputError, parseEvaluations } from '../src/lib/member-evaluation';

// Thai calendar day at a given Thai hour, as a UTC Date.
const th = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+07:00`);

const base = (over: Partial<ReviewItem>): ReviewItem => ({
  id: Math.random().toString(36).slice(2), kind: 'task', title: 't', memberId: 'a', memberIds: [], status: 'todo',
  due: null, submittedAt: null, waitingOn: null, firstReview: null, reviseReason: null, ...over,
});
const members = [{ id: 'a', name: 'แต้ว', avatar: null, company: 'GFS' }, { id: 'b', name: 'นน', avatar: null, company: 'MHL' }];
const run = (items: ReviewItem[], today = '2026-11-20') =>
  summarizeMonth({ year: 2026, month: 11, today, members, items, kpis: [], evaluations: [] });

test('on time = handed in on or before the due day (Thai time); late or missing is not', () => {
  const s = run([
    base({ due: th('2026-11-05'), submittedAt: th('2026-11-05', 23) }),
    base({ due: th('2026-11-05'), submittedAt: th('2026-11-06', 0) }),
    base({ due: th('2026-11-10') }),
  ]);
  assert.deepEqual(s.members[0].onTime, { done: 1, total: 3 });
});

test('work due after today or outside the month is not counted yet', () => {
  const s = run([base({ due: th('2026-11-25') }), base({ due: th('2026-10-31') }), base({ due: th('2026-12-01', 1) })]);
  assert.deepEqual(s.members[0].onTime, { done: 0, total: 0 });
  assert.equal(s.countedThrough, '2026-11-20');
  assert.equal(run([], '2027-01-05').countedThrough, '2026-11-30');
});

test('work held up by someone else is set aside, not counted late', () => {
  const s = run([base({ due: th('2026-11-03'), waitingOn: 'รอรูปจากช่าง' })]);
  assert.equal(s.members[0].waiting, 1);
  assert.deepEqual(s.members[0].onTime, { done: 0, total: 0 });
});

test('first pass: a revision for a changed brief is not the worker\'s mistake', () => {
  const s = run([
    base({ due: th('2026-11-03'), firstReview: 'pass' }),
    base({ due: th('2026-11-03'), firstReview: 'revise', reviseReason: 'brief' }),
    base({ due: th('2026-11-03'), firstReview: 'revise', reviseReason: 'quality' }),
    base({ due: th('2026-11-03') }),
  ]);
  assert.deepEqual(s.members[0].firstPass, { done: 2, total: 3 });
  assert.equal(percent(s.members[0].firstPass), 67);
  assert.equal(percent({ done: 0, total: 0 }), null);
});

test('shared work counts for each assignee but once for the team', () => {
  const s = run([base({ memberIds: ['a', 'b'], due: th('2026-11-02'), submittedAt: th('2026-11-01') })]);
  assert.deepEqual(s.members.map(m => m.onTime.total), [1, 1]);
  assert.deepEqual(s.team.onTime, { done: 1, total: 1 });
});

test('published content splits organic/paid and averages D+7 reach per side', () => {
  const s = run([
    base({ kind: 'content', status: 'done', due: th('2026-11-02'), promotion: 'organic', reach7: 100 }),
    base({ kind: 'content', status: 'done', due: th('2026-11-03'), promotion: 'organic', reach7: 301 }),
    base({ kind: 'content', status: 'done', due: th('2026-11-04'), promotion: 'paid', reach7: null }),
    base({ kind: 'content', status: 'done', due: th('2026-11-05') }),
    base({ kind: 'content', status: 'todo', due: th('2026-11-05'), promotion: 'paid' }),
  ]);
  assert.deepEqual(s.members[0].published, { organic: 2, paid: 1, unknown: 1 });
  assert.deepEqual(s.members[0].reach7, { organic: 201, paid: null, posts: 2 });
  assert.deepEqual(s.team.published, { organic: 2, paid: 1, unknown: 1 });
});

test('month query range covers Thai days 1st 00:00 to last day 23:59', () => {
  const { gte, lt } = monthQueryRange(2026, 11);
  assert.equal(gte.toISOString(), '2026-10-31T17:00:00.000Z');
  assert.equal(lt.toISOString(), '2026-11-30T17:00:00.000Z');
});

test('review input: validates choices, clears with empty, drops reason on pass', () => {
  assert.deepEqual(parseWorkReview({ firstReview: 'pass', reviseReason: 'quality' }, 'task'), { firstReview: 'pass', reviseReason: null });
  assert.deepEqual(parseWorkReview({ firstReview: 'revise', reviseReason: 'brief' }, 'task'), { firstReview: 'revise', reviseReason: 'brief' });
  assert.deepEqual(parseWorkReview({ waitingOn: '  ', submittedAt: '' }, 'task'), { waitingOn: null, submittedAt: null });
  assert.deepEqual(parseWorkReview({ promotion: 'paid' }, 'task'), {}, 'tasks have no organic/paid');
  assert.deepEqual(parseWorkReview({ promotion: 'paid' }, 'content'), { promotion: 'paid' });
  assert.throws(() => parseWorkReview({ firstReview: 'maybe' }, 'task'), WorkReviewError);
  assert.throws(() => parseWorkReview({ submittedAt: 'not a date' }, 'task'), WorkReviewError);
});

test('hand-in time follows the status', () => {
  const now = new Date('2026-11-05T03:00:00Z');
  const earlier = new Date('2026-11-04T03:00:00Z');
  assert.equal(submittedAtForStatus({ status: 'in_progress', submittedAt: null }, 'done', now), now);
  assert.equal(submittedAtForStatus({ status: 'in_progress', submittedAt: earlier }, 'done', now), earlier);
  assert.equal(submittedAtForStatus({ status: 'done', submittedAt: earlier }, 'in_progress', now), null);
  assert.equal(submittedAtForStatus({ status: 'todo', submittedAt: null }, 'in_progress', now), undefined);
  assert.equal(submittedAtForStatus({ status: 'done', submittedAt: earlier }, undefined, now), undefined);
});

test('evaluation upload matches members by id or name and rejects bad input', () => {
  const list = [{ id: 'a', name: 'แต้ว' }, { id: 'b', name: 'นน' }];
  const parsed = parseEvaluations({ year: 2026, month: 11, evaluations: [{ memberName: 'นน', summary: ' ดีมาก ' }, { memberId: 'a', summary: 'ok', nextSteps: '' }] }, list);
  assert.deepEqual(parsed.evaluations.map(e => [e.memberId, e.summary, e.nextSteps]), [['b', 'ดีมาก', null], ['a', 'ok', null]]);
  assert.throws(() => parseEvaluations({ year: 2026, month: 13, evaluations: [{ memberId: 'a', summary: 'x' }] }, list), EvaluationInputError);
  assert.throws(() => parseEvaluations({ year: 2026, month: 11, evaluations: [{ memberName: 'ใครก็ไม่รู้', summary: 'x' }] }, list), EvaluationInputError);
  assert.throws(() => parseEvaluations({ year: 2026, month: 11, evaluations: [{ memberId: 'a', summary: '' }] }, list), EvaluationInputError);
  assert.throws(() => parseEvaluations({ year: 2026, month: 11, evaluations: [{ memberId: 'a', summary: 'x' }, { memberName: 'แต้ว', summary: 'y' }] }, list), EvaluationInputError);
});

test('KPI กลาง shows no money: no price, cost, sales or spend in its code', () => {
  const files = ['src/lib/kpi-summary.ts', 'src/app/kpi-hub/page.tsx', 'src/app/api/kpi-hub/route.ts'];
  const text = files.map(file => readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(text, /ราคา|ต้นทุน|ยอดขาย|฿|บาท|adSpend|spend/);
});

test('months before hand-in tracking began are not timed (no false 0%)', () => {
  const s = summarizeMonth({
    year: 2026, month: 10, today: '2026-11-20', members, kpis: [], evaluations: [],
    items: [base({ due: th('2026-10-10'), status: 'done' }), base({ kind: 'content', status: 'done', due: th('2026-10-12') })],
  });
  assert.deepEqual(s.team.onTime, { done: 0, total: 0 });
  assert.deepEqual(s.members[0].onTime, { done: 0, total: 0 });
  assert.equal(s.team.published.unknown, 1, 'published counts still show for old months');
  assert.equal(s.trackingStart, '2026-11-01');
});

test('KPI progress matches the old page: max of typed count and finished linked work', async () => {
  const { kpiCurrent } = await import('../src/lib/kpi-summary');
  const kpi = { id: 'k1', memberId: 'a', current: 1 };
  const work = (over: object) => ({ kind: 'task' as const, kpiId: 'k1', status: 'done', memberId: 'a', memberIds: ['a'], ...over });
  assert.equal(kpiCurrent(kpi, []), 1, 'typed count when nothing is linked');
  assert.equal(kpiCurrent(kpi, [
    work({}), work({ status: 'เสร็จแล้ว' }), work({ kpiId: 'k0,k1' }),
    work({ kind: 'content', status: 'published' }), work({ kind: 'content', status: 'done' }),
    work({ status: 'in_progress' }), work({ memberId: 'b', memberIds: ['b'] }), work({ kpiId: 'k2' }),
  ]), 5);
});

test('content with the older "published" status counts as published', () => {
  const s = run([base({ kind: 'content', status: 'published', due: th('2026-11-02'), promotion: 'organic' })]);
  assert.equal(s.team.published.organic, 1);
});
