import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bangkokDateKey } from '../src/lib/bangkok-date';
import { ideaBoardStatus, isContentDone } from '../src/lib/dashboard-items';
import { requireOk, saveErrorMessage } from '../src/lib/save-result';
import { yearOptions } from '../src/lib/year-options';
import { currentBangkokMonth, dueByEndOf, inMonth, monthLabel } from '../src/lib/month-filter';
import { joinKpiIds, taskHasKpi, taskKpiOptions, validTaskKpiIds } from '../src/lib/task-kpi';
import { readFileSync } from 'node:fs';
import { loadSource } from './route-harness';

test('dashboard months follow the Thai calendar and keep earlier unfinished work pending', () => {
  const october = { year: 2026, month: 10 };
  assert.deepEqual(currentBangkokMonth(new Date('2026-10-31T17:30:00.000Z')), { year: 2026, month: 11 });
  assert.equal(monthLabel(october), 'ต.ค. 2026');
  // Due 1 Oct 00:00 in Bangkok is stored as 30 Sep 17:00 UTC.
  assert.equal(inMonth('2026-09-30T17:00:00.000Z', october), true);
  assert.equal(inMonth('2026-10-31T17:00:00.000Z', october), false);
  assert.equal(inMonth(null, october), false);
  assert.equal(dueByEndOf('2026-08-15T03:00:00.000Z', october), true);
  assert.equal(dueByEndOf('2026-10-20T03:00:00.000Z', october), true);
  assert.equal(dueByEndOf('2026-11-02T03:00:00.000Z', october), false);
  assert.equal(dueByEndOf(null, october), true);
});

test('tasks offer only their assignees KPIs for the Thai month of the deadline', () => {
  const kpis = [
    { id: 'non-oct', name: 'ออกถ่ายงานนอกสถานที่', memberId: 'non', month: 10, year: 2026 },
    { id: 'non-sep', name: 'เก็บรูปถ่ายงานติดตั้ง', memberId: 'non', month: 9, year: 2026 },
    { id: 'taw-oct', name: 'งานทั่วไป', memberId: 'taw', month: 10, year: 2026 },
  ];
  // Due 1 Oct 00:00 Bangkok (stored 30 Sep 17:00 UTC) belongs to October.
  assert.deepEqual(taskKpiOptions(kpis, 'non', '2026-09-30T17:00:00.000Z').map(kpi => kpi.id), ['non-oct']);
  assert.deepEqual(taskKpiOptions(kpis, 'non,taw', '2026-10-20T03:00:00.000Z').map(kpi => kpi.id), ['non-oct', 'taw-oct']);
  assert.deepEqual(taskKpiOptions(kpis, 'all', '2026-10-20T03:00:00.000Z').map(kpi => kpi.id), ['non-oct', 'taw-oct']);
  assert.deepEqual(taskKpiOptions(kpis, 'non', ''), []);
  assert.equal(validTaskKpiIds(kpis, 'non', '2026-10-20T03:00:00.000Z', 'non-oct'), 'non-oct');
  assert.equal(validTaskKpiIds(kpis, 'taw', '2026-10-20T03:00:00.000Z', 'non-oct'), null);
  assert.equal(validTaskKpiIds(kpis, 'non', '2026-09-20T03:00:00.000Z', 'non-oct'), null);
  assert.equal(validTaskKpiIds(kpis, 'non', '2026-10-20T03:00:00.000Z', ''), null);
  // One task can count for several people: unrelated or out-of-month ids are dropped.
  assert.equal(validTaskKpiIds(kpis, 'non,taw', '2026-10-20T03:00:00.000Z', 'non-oct,taw-oct,non-sep'), 'non-oct,taw-oct');
  assert.equal(validTaskKpiIds(kpis, 'taw', '2026-10-20T03:00:00.000Z', 'non-oct,taw-oct'), 'taw-oct');
});

test('stored KPI links stay compatible: one id counts as before, several ids count for each KPI', () => {
  assert.equal(taskHasKpi('non-oct', 'non-oct'), true);
  assert.equal(taskHasKpi('non-oct,taw-oct', 'taw-oct'), true);
  assert.equal(taskHasKpi('non-oct,taw-oct', 'non'), false);
  assert.equal(taskHasKpi(null, 'non-oct'), false);
  assert.equal(joinKpiIds(' b , a,b ,'), 'b,a');
  assert.equal(joinKpiIds(['a', 'a']), 'a');
  assert.equal(joinKpiIds(''), null);
  assert.equal(joinKpiIds(undefined), null);
});

test('year filters always include the current and next year', () => {
  assert.deepEqual(yearOptions(new Date('2026-10-20')), [2024, 2025, 2026, 2027]);
  assert.deepEqual(yearOptions(new Date('2027-01-02')), [2024, 2025, 2026, 2027, 2028]);
});

test('the saved KPI dictionary is returned before the bundled file', async () => {
  const saved = [{ id: '1', name: 'แก้จากหน้าเว็บ', description: 'saved' }];
  const load = (description: string | null) => loadSource('src/app/api/kpi-dict/route.ts', {
    '@/lib/prisma': { prisma: { ideaNote: { findFirst: async () => (description === null ? null : { description }) } } },
  }, { process: { env: {}, cwd: () => process.cwd() } });
  assert.deepEqual(await (await load(JSON.stringify(saved)).GET()).json(), saved);
  const bundled = JSON.parse(readFileSync('new_dict.json', 'utf8'));
  assert.deepEqual(await (await load(null).GET()).json(), bundled);
});

test('calendar day follows Thai time instead of the UTC part of the timestamp', () => {
  // A deadline picked as 20 Oct 00:00 in Bangkok is stored as 19 Oct 17:00 UTC.
  assert.equal(bangkokDateKey('2026-10-19T17:00:00.000Z'), '2026-10-20');
  assert.equal(bangkokDateKey('2026-10-20T06:59:00.000Z'), '2026-10-20');
  assert.equal(bangkokDateKey('2026-10-20T17:00:00.000Z'), '2026-10-21');
  // Date-only values saved as UTC midnight keep their day.
  assert.equal(bangkokDateKey('2026-10-20'), '2026-10-20');
  assert.equal(bangkokDateKey('2026-10-20T00:00:00.000Z'), '2026-10-20');
  assert.equal(bangkokDateKey('not a date'), '');
});

test('ideas marked finished in the idea pane appear as done on the board', () => {
  assert.equal(ideaBoardStatus('เสร็จสิ้น'), 'done');
  assert.equal(ideaBoardStatus('เสร็จแล้ว'), 'done');
  assert.equal(ideaBoardStatus('done'), 'done');
  assert.equal(ideaBoardStatus('approved'), 'done');
  assert.equal(ideaBoardStatus('รอดำเนินการ'), 'todo');
  assert.equal(ideaBoardStatus('pending'), 'todo');
  assert.equal(ideaBoardStatus(null), 'todo');
  assert.equal(ideaBoardStatus('กำลังดำเนินการ'), 'in_progress');
  assert.equal(ideaBoardStatus('รอตรวจ'), 'in_progress');
});

test('content ticked in meetings counts as done; drafts and todo do not', () => {
  for (const status of ['done', 'published', 'เสร็จแล้ว']) assert.equal(isContentDone(status), true);
  for (const status of ['draft', 'todo', 'in_progress', '', null, undefined]) assert.equal(isContentDone(status), false);
});

test('refused saves raise the server message; accepted saves pass through', async () => {
  const ok = Response.json({ success: true });
  assert.equal(await requireOk(Promise.resolve(ok)), ok);
  await assert.rejects(requireOk(Response.json({ error: 'กรุณาเลือกผู้รับผิดชอบ' }, { status: 400 })), /บันทึกไม่สำเร็จ: กรุณาเลือกผู้รับผิดชอบ/);
  await assert.rejects(requireOk(new Response('oops', { status: 500 })), /บันทึกไม่สำเร็จ กรุณาลองใหม่/);
  assert.match(saveErrorMessage(new TypeError('Failed to fetch')), /ตรวจการเชื่อมต่อ/);
});
