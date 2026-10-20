import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bangkokDateKey } from '../src/lib/bangkok-date';
import { ideaBoardStatus, isContentDone } from '../src/lib/dashboard-items';
import { requireOk, saveErrorMessage } from '../src/lib/save-result';

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
