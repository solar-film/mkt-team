import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSource } from './route-harness';
import { pendingStats, pendingStatsFor, snapshotDue, statsReminderText } from '../src/lib/stats-due';

// "Now" is 20 Oct 2026, 10:00 in Bangkok.
const now = new Date('2026-10-20T03:00:00.000Z');
const content = (id: string, publishDate: string, extra: Record<string, unknown> = {}) => ({
  id, title: `Post ${id}`, status: 'done', publishDate, memberId: 'non', memberIds: ['non'], metrics: [] as { snapshot: string }[], ...extra,
});

test('snapshots fall due on Thai calendar days after publishing', () => {
  // Published 13 Oct 00:30 Bangkok (12 Oct 17:30 UTC): D+7 is due on 20 Oct, today.
  assert.deepEqual(snapshotDue(content('a', '2026-10-12T17:30:00.000Z'), 7, now), { due: true, daysOverdue: 0, dueDate: '2026-10-20' });
  // Published 14 Oct: D+7 falls on 21 Oct, not yet due.
  assert.equal(snapshotDue(content('b', '2026-10-14T03:00:00.000Z'), 7, now).due, false);
  assert.deepEqual(snapshotDue(content('c', '2026-10-01T03:00:00.000Z'), 15, now), { due: true, daysOverdue: 4, dueDate: '2026-10-16' });
});

test('only published content from 1 Oct 2026 with missing snapshots is listed, most overdue first', () => {
  const items = pendingStats([
    content('sep', '2026-09-28T03:00:00.000Z'), // before tracking started
    content('edge', '2026-09-30T17:30:00.000Z'), // 1 Oct 00:30 in Bangkok, inside tracking
    content('draft', '2026-10-02T03:00:00.000Z', { status: 'todo' }),
    content('recorded', '2026-10-05T03:00:00.000Z', { metrics: [{ snapshot: 'D+7' }] }),
    content('today', '2026-10-13T03:00:00.000Z'),
  ], now);
  assert.deepEqual(items.map(item => `${item.contentId}:${item.snapshot}:${item.daysOverdue}`), [
    // Equal lateness keeps D+7 before D+15.
    'edge:D+7:12', 'edge:D+15:4', 'today:D+7:0', 'recorded:D+15:0',
  ]);
});

test('owner lists include shared and everyone assignments', () => {
  const items = pendingStats([
    content('shared', '2026-10-05T03:00:00.000Z', { memberIds: ['non', 'taw'] }),
    content('everyone', '2026-10-05T03:00:00.000Z', { memberIds: ['all'] }),
    content('pleng', '2026-10-05T03:00:00.000Z', { memberId: 'pleng', memberIds: ['pleng'] }),
  ], now);
  assert.deepEqual(new Set(pendingStatsFor(items, 'taw').map(item => item.contentId)), new Set(['shared', 'everyone']));
  assert.equal(pendingStatsFor(items, 'all').length, items.length);
  const text = statsReminderText(items, new Map([['non', 'NON'], ['taw', 'TAW'], ['pleng', 'PLENG']]));
  assert.match(text, /สถิติคอนเทนต์ที่ต้องกรอก 6 รายการ/);
  // Published 5 Oct: D+7 was due 12 Oct (8 days late), D+15 is due today.
  assert.match(text, /- NON: D\+7 1, D\+15 1 \(เลยกำหนดสุด 8 วัน\)/);
  assert.match(text, /- ทุกคน: D\+7 1, D\+15 1/);
});

test('reminder API returns only the requested owner items without loading content details', async () => {
  const calls: any[] = [];
  const prisma = { content: { findMany: async (args: any) => {
    calls.push(args);
    return [content('mine', '2026-10-05T03:00:00.000Z'), content('other', '2026-10-05T03:00:00.000Z', { memberId: 'taw', memberIds: ['taw'] })];
  } } };
  const route = loadSource('src/app/api/content-metrics/due/route.ts', { '@/lib/prisma': { prisma } });
  const body = await (await route.GET(new Request('http://localhost/api/content-metrics/due?memberId=non'))).json();
  assert.equal(JSON.stringify(calls[0].select.metrics), JSON.stringify({ select: { snapshot: true } }));
  assert.equal(calls[0].select.description, undefined);
  assert.ok(body.items.every((item: any) => item.contentId === 'mine'));
  assert.equal(body.total, body.items.length);
  assert.ok(body.total > 0);
});
