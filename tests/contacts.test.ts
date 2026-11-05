import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  accountLines, callDate, companyChannelTable, dailyByChannel, DATASET_SOURCES, mergeCarLine, monthContacts, monthNew, normalizeGoodCrmRows, parseCsv,
  summarizeAdminSheet, summarizeCallLog, summarizeCarLineDaily, summarizeCarStatsSheet, validatePhoneUpload, weekdayAverages, type ContactRow,
} from '../src/lib/contact-data';

// Made-up callers and figures; real numbers never enter this public repository.
// Office lines are the companies' published numbers (also listed on the โครงสร้างธุรกิจ page).

const HEADER = '"Start Date","End Date","Duration(secs)","Call ID","Dir.","Local Party","Remote Party","Last Name","First Name"';
const call = (start: string, dir: string, local: string, remote: string, name = 'GOOD FILM CO LTD 1') =>
  `"${start}","${start}","30","x","${dir}","${local}","${remote}","${name}",""`;

test('CSV parser keeps quoted commas, doubled quotes and CRLF rows', () => {
  assert.deepEqual(parseCsv('a,"b,c","say ""hi"""\r\n1,2,3\r\n'), [['a', 'b,c', 'say "hi"'], ['1', '2', '3']]);
  assert.deepEqual(parseCsv('﻿x\n\n'), [['x']]);
});

test('call dates accept ISO and Thai day/month/year, Buddhist years included', () => {
  assert.equal(callDate('2026-10-31 23:59:00'), '2026-10-31');
  assert.equal(callDate('31/10/2569 08:00'), '2026-10-31');
  assert.equal(callDate('1/2/2026'), '2026-02-01');
  assert.equal(callDate('2026-02-30'), null);
  assert.equal(callDate('yesterday'), null);
});

test('call log counts each incoming caller once per day per office line, by company', () => {
  const text = [
    HEADER,
    call('2026-10-30 09:00:00', 'IN', '+6629063424', '+66811111111'),
    call('2026-10-30 10:00:00', 'IN', '+6629063424', '0811111111'), // same caller, same day
    call('2026-10-30 11:00:00', 'OUT', '+6629063424', '0822222222'), // outgoing: not a contact
    call('2026-10-30 12:00:00', 'IN', '+66994565294', '0833333333', 'MAHOLAN FILM CO LTD 1'),
    call('2026-10-31 09:00:00', 'IN', '+66959533949', '0811111111', 'MAHOLAN FILM CO LTD 7'),
    call('2026-10-31 09:30:00', 'IN', '+66959533949', '', 'MAHOLAN FILM CO LTD 7'), // hidden number
    call('2026-10-31 09:40:00', 'IN', '+66959533949', 'anonymous', 'MAHOLAN FILM CO LTD 7'),
    call('2026-10-31 10:00:00', 'IN', '+66900000000', '0844444444', 'MAHOLAN FILM CO LTD 9'), // unknown MHL line
  ].join('\n');
  const summary = summarizeCallLog(text);
  assert.equal(summary.from, '2026-10-30');
  assert.equal(summary.to, '2026-10-31');
  assert.equal(summary.calls, 8);
  assert.equal(summary.inbound, 7);
  assert.deepEqual(summary.companies, ['GFS', 'MHL', 'CAR']);
  assert.deepEqual(summary.rows, [
    { date: '2026-10-30', company: 'GFS', account: '02-906-3424', contacts: 1 },
    { date: '2026-10-30', company: 'MHL', account: '099-456-5294', contacts: 1 },
    { date: '2026-10-31', company: 'CAR', account: '095-953-3949', contacts: 3 },
    { date: '2026-10-31', company: 'MHL', account: '090-000-0000', contacts: 1 },
  ]);
  // Phone numbers of callers never appear in what is sent to the server.
  assert.ok(!JSON.stringify(summary).includes('811111111'));
});

test('call log with unknown columns or no incoming calls is refused with a reason', () => {
  assert.throws(() => summarizeCallLog('Name,Phone\na,1'), /Start Date/);
  assert.throws(() => summarizeCallLog([HEADER, call('2026-10-30 09:00:00', 'Outgoing', '+6629063424', '0811111111')].join('\n')), /Outgoing/);
  assert.throws(() => summarizeCallLog([HEADER, call('not a date', 'IN', '+6629063424', '0811111111')].join('\n')), /แถวที่ 2/);
  assert.equal(summarizeCallLog([HEADER, call('2026-10-30 09:00', 'Incoming', '+6629063424', '0811111111')].join('\n')).inbound, 1);
});

test('phone upload validation rejects rows outside the file, foreign companies, duplicates and bad counts', () => {
  const good = { from: '2026-10-01', to: '2026-10-31', companies: ['GFS'], rows: [{ date: '2026-10-02', company: 'GFS', account: '02-906-3424', contacts: 4 }] };
  assert.deepEqual(validatePhoneUpload(good), good);
  assert.equal(typeof validatePhoneUpload({ ...good, rows: [{ ...good.rows[0], date: '2026-11-01' }] }), 'string');
  assert.equal(typeof validatePhoneUpload({ ...good, rows: [{ ...good.rows[0], company: 'MHL' }] }), 'string');
  assert.equal(typeof validatePhoneUpload({ ...good, rows: [good.rows[0], good.rows[0]] }), 'string');
  assert.equal(typeof validatePhoneUpload({ ...good, rows: [{ ...good.rows[0], contacts: -1 }] }), 'string');
  assert.equal(typeof validatePhoneUpload({ ...good, rows: [{ ...good.rows[0], contacts: 1.5 }] }), 'string');
  assert.equal(typeof validatePhoneUpload({ ...good, from: '2026-11-01' }), 'string');
  assert.equal(typeof validatePhoneUpload(null), 'string');
});

test('GOOD CRM rows are checked field by field; unlabelled accounts are left out', () => {
  const rows = normalizeGoodCrmRows([
    { day: '2026-10-30', platform: 'line', company: 'GFS', account: '@example', contacts: 5, new_contacts: 2 },
    { day: '2026-10-30', platform: 'facebook', company: 'OTHER', account: 'บัญชีอื่น', contacts: 1, new_contacts: 1 },
  ]);
  assert.deepEqual(rows, [{ date: '2026-10-30', channel: 'line', company: 'GFS', account: '@example', contacts: 5, newContacts: 2 }]);
  assert.throws(() => normalizeGoodCrmRows({ message: 'Forbidden' }));
  assert.throws(() => normalizeGoodCrmRows([{ day: '2026-10-30', platform: 'phone', company: 'GFS', account: 'x', contacts: 1, new_contacts: 0 }]));
  assert.throws(() => normalizeGoodCrmRows([{ day: '2026-10-30', platform: 'line', company: 'GFS', account: 'x', contacts: 1, new_contacts: 2 }]));
});

const rows: ContactRow[] = [
  { date: '2026-10-05', channel: 'line', company: 'GFS', account: '@a', contacts: 10, newContacts: 4 },
  { date: '2026-10-05', channel: 'facebook', company: 'GFS', account: 'page', contacts: 6, newContacts: 6 },
  { date: '2026-10-06', channel: 'phone', company: 'MHL', account: '02-000-0000', contacts: 3, newContacts: null },
  { date: '2026-10-20', channel: 'line', company: 'GFS', account: '@a', contacts: 2, newContacts: 0 },
  { date: '2026-09-05', channel: 'line', company: 'GFS', account: '@a', contacts: 7, newContacts: 1 },
];
const all = { company: 'all', channel: 'all' } as const;

test('monthly totals, like-for-like cut-off and new contacts', () => {
  assert.equal(monthContacts(rows, '2026-10', all), 21);
  assert.equal(monthContacts(rows, '2026-10', all, 6), 19);
  assert.equal(monthContacts(rows, '2026-10', { company: 'GFS', channel: 'line' }), 12);
  assert.equal(monthNew(rows, '2026-10', all), 10);
  assert.equal(monthNew(rows, '2026-10', { company: 'MHL', channel: 'phone' }), null);
});

test('daily series, company table and account lines add up', () => {
  const days = dailyByChannel(rows, '2026-10', 31, all);
  assert.equal(days.length, 31);
  assert.deepEqual([days[4].line, days[4].facebook, days[4].total], [10, 6, 16]);
  const table = companyChannelTable(rows, '2026-10', all);
  assert.equal(table.find(r => r.company === 'GFS')?.total, 18);
  assert.equal(table.find(r => r.company === 'GFS')?.prevTotal, 7);
  const lines = accountLines(rows, '2026-10', all);
  assert.deepEqual(lines[0], { channel: 'line', company: 'GFS', account: '@a', contacts: 12, newContacts: 4, days: 2 });
  assert.equal(lines.find(l => l.channel === 'phone')?.newContacts, null);
});

test('weekday averages skip today and later days, Monday first', () => {
  const averages = weekdayAverages(rows, '2026-10', 31, '2026-10-07', all);
  assert.equal(averages[0].label, 'จ.');
  // 5 Oct 2026 is a Monday, 6 Oct a Tuesday; 7 Oct (today) is not counted.
  assert.deepEqual(averages.slice(0, 3).map(a => a.average), [16, 3, null]);
});

test('CAR_Line_Daily counts message rows per day from the first full covered day; customer IDs are not needed', () => {
  const kinds = [['kind'], ['coverage'], ['message'], ['message'], ['message'], [], ['message']];
  const days = [['day', 'first_at'], ['', '2026-10-01T06:24:22.344Z'], ['2026-10-01', 'x'], ['2026-10-02', 'x'], ['2026-10-02', 'x'], [], ['2026-10-03', 'x']];
  assert.deepEqual(summarizeCarLineDaily(kinds, days), { from: '2026-10-02', rows: [{ date: '2026-10-02', contacts: 2 }, { date: '2026-10-03', contacts: 1 }] });
  assert.throws(() => summarizeCarLineDaily([['kind'], ['message']], [['day'], ['2026-10-02']]), /coverage/);
  assert.throws(() => summarizeCarLineDaily([['x']], [['day']]), /หัวคอลัมน์/);
  assert.throws(() => summarizeCarLineDaily([['kind'], ['coverage'], ['message']], [['day'], ['', '2026-10-01T00:00:00Z'], ['31/10/2026']]), /แถวที่ 3/);
});

test('CAR LINE from the sheet replaces GOOD CRM from its first full day, and never overlaps when the sheet fails', () => {
  const crm: ContactRow[] = [
    { date: '2026-10-01', channel: 'line', company: 'CAR', account: '@maholan', contacts: 9, newContacts: 3 },
    { date: '2026-10-02', channel: 'line', company: 'CAR', account: '@maholan', contacts: 1, newContacts: 1 },
    { date: '2026-10-02', channel: 'facebook', company: 'CAR', account: 'page', contacts: 4, newContacts: 2 },
  ];
  const sheet = { from: '2026-10-02', rows: [{ date: '2026-10-02', contacts: 13 }, { date: '2026-11-05', contacts: 2 }] };
  const ok = mergeCarLine(crm, sheet, { from: '2026-09-01', to: '2026-10-31' }, new Set());
  assert.deepEqual(ok.goodcrm.map(r => `${r.date} ${r.channel}`), ['2026-10-01 line', '2026-10-02 facebook']);
  assert.deepEqual(ok.sheet, [{ date: '2026-10-02', channel: 'line', company: 'CAR', account: '@maholan', contacts: 13, newContacts: null }]);
  const failed = mergeCarLine(crm, null, { from: '2026-09-01', to: '2026-10-31' }, new Set(['2026-10-02']));
  assert.equal(failed.sheet, null);
  assert.deepEqual(failed.goodcrm.map(r => `${r.date} ${r.channel}`), ['2026-10-01 line', '2026-10-02 facebook']);
});

// Admin lead sheets: made-up counts in the real column layout.
const adminHeader = () => {
  const blocks = Array<string>(54).fill('');
  blocks[8] = 'GFS'; blocks[17] = 'MHL'; blocks[46] = 'GFS'; blocks[50] = 'MHL';
  const header = Array<string>(54).fill('');
  Object.assign(header, {
    0: 'วันที่', 6: 'Line', 7: 'FB', 8: 'รวม\nโทร.', 9: 'รวมแชท', 10: 'ลค.ใหม่',
    15: 'Line', 16: 'FB', 17: 'รวม\nโทร.', 18: 'รวมแชท', 19: 'ลค.ใหม่',
    46: 'Tel', 47: 'Line', 48: 'FB', 49: 'Walk In', 50: 'Tel', 51: 'Line', 52: 'FB', 53: 'Walk In',
  });
  return [blocks, header];
};
const adminDay = (label: string, gfs: [string, string, string, string, string], mhl: [string, string, string, string, string]) => {
  const row = Array<string>(54).fill('');
  row[0] = label;
  [row[8], row[6], row[7], row[49], row[10]] = gfs; // โทร, Line, FB, Walk In, ลค.ใหม่
  [row[17], row[15], row[16], row[53], row[19]] = mhl;
  return row;
};

test('admin sheet: one row per company and channel with contacts; new customers ride on the first chat row; blanks after today are skipped', () => {
  const values = [
    ...adminHeader(),
    adminDay('วันพุธ  01/11/23', ['2', '11', '0', '', '3'], ['1', '20', '3', '1', '4']),
    adminDay('วันพฤหัสบดี  02/11/23', ['0', '0', '0', '0', '0'], ['', '', '', '', '']), // nothing that day
    adminDay('วันศุกร์  03/11/23', ['1,000', '', '', '', '0'], ['', '', '', '', '2']), // phone only; MHL new customers without a count
    adminDay('วันจันทร์  06/11/23', ['5', '5', '5', '5', '5'], ['5', '5', '5', '5', '5']), // after upto: pre-filled, ignored
    [],
  ];
  const summary = summarizeAdminSheet(values, '2023-11-05');
  assert.deepEqual(summary.rows, [
    { date: '2023-11-01', channel: 'line', company: 'GFS', account: 'ชีตแอดมิน', contacts: 11, newContacts: 3 },
    { date: '2023-11-01', channel: 'phone', company: 'GFS', account: 'ชีตแอดมิน', contacts: 2, newContacts: null },
    { date: '2023-11-01', channel: 'facebook', company: 'MHL', account: 'ชีตแอดมิน', contacts: 3, newContacts: null },
    { date: '2023-11-01', channel: 'line', company: 'MHL', account: 'ชีตแอดมิน', contacts: 20, newContacts: 4 },
    { date: '2023-11-01', channel: 'phone', company: 'MHL', account: 'ชีตแอดมิน', contacts: 1, newContacts: null },
    { date: '2023-11-01', channel: 'walkin', company: 'MHL', account: 'ชีตแอดมิน', contacts: 1, newContacts: null },
    { date: '2023-11-03', channel: 'phone', company: 'GFS', account: 'ชีตแอดมิน', contacts: 1000, newContacts: 0 },
    { date: '2023-11-03', channel: 'line', company: 'MHL', account: 'ชีตแอดมิน', contacts: 0, newContacts: 2 },
  ]);
  assert.equal(summary.from, '2023-11-01');
  assert.equal(summary.to, '2023-11-03');
  assert.deepEqual(summary.duplicateDays, []);
  assert.equal(monthNew(summary.rows, '2023-11', { company: 'all', channel: 'all' }), 9);
});

test('admin sheet refuses a moved column, an unreadable date or a non-number', () => {
  const [blocks, header] = adminHeader();
  const moved = [...header]; moved[49] = 'Tel';
  assert.throws(() => summarizeAdminSheet([blocks, moved], '2026-12-31'), /คอลัมน์ที่ 50/);
  assert.throws(() => summarizeAdminSheet([...adminHeader(), adminDay('รวมทั้งเดือน', ['1', '', '', '', ''], ['', '', '', '', ''])], '2026-12-31'), /แถวที่ 3/);
  assert.throws(() => summarizeAdminSheet([...adminHeader(), adminDay('วันพุธ  01/11/23', ['x', '', '', '', ''], ['', '', '', '', ''])], '2026-12-31'), /ไม่ใช่จำนวน/);
  assert.equal(summarizeAdminSheet(adminHeader(), '2026-12-31').rows.length, 0);
});

test('CAR CRM stats sheet: Buddhist dates, five channels, duplicated days summed and reported', () => {
  const values = [
    ['ST_ID', 'วันที่', 'โทร', 'Line', 'FB', 'Tiktok', 'WalkIn', 'หมายเหตุ', 'ผู้บันทึก', 'วันที่บันทึกรายการ'],
    ['a', '1/9/2569', '2', '2', '15', '0', '1', '', 'staff', ''],
    ['b', '1/9/2569', '5', '5', '20', '', '1', '', 'staff', ''],
    ['c', '2/9/2569', '0', '8', '13', '1', '0', 'นับอัตโนมัติ', 'ระบบ', ''],
    ['d', '', '', '', '', '', '', '', '', ''],
    ['e', '3/9/2569', '9', '9', '9', '9', '9', '', '', ''], // after upto
  ];
  const summary = summarizeCarStatsSheet(values, '2026-09-02');
  assert.deepEqual(summary.rows, [
    { date: '2026-09-01', channel: 'facebook', company: 'CAR', account: 'ชีต CAR CRM', contacts: 35, newContacts: null },
    { date: '2026-09-01', channel: 'line', company: 'CAR', account: 'ชีต CAR CRM', contacts: 7, newContacts: null },
    { date: '2026-09-01', channel: 'phone', company: 'CAR', account: 'ชีต CAR CRM', contacts: 7, newContacts: null },
    { date: '2026-09-01', channel: 'walkin', company: 'CAR', account: 'ชีต CAR CRM', contacts: 2, newContacts: null },
    { date: '2026-09-02', channel: 'facebook', company: 'CAR', account: 'ชีต CAR CRM', contacts: 13, newContacts: null },
    { date: '2026-09-02', channel: 'line', company: 'CAR', account: 'ชีต CAR CRM', contacts: 8, newContacts: null },
    { date: '2026-09-02', channel: 'tiktok', company: 'CAR', account: 'ชีต CAR CRM', contacts: 1, newContacts: null },
  ]);
  assert.deepEqual(summary.duplicateDays, ['2026-09-01']);
  assert.throws(() => summarizeCarStatsSheet([['ST_ID', 'วันที่', 'โทร']], '2026-12-31'), /ไม่พบหัวคอลัมน์ line, fb, tiktok, walkin/);
  assert.throws(() => summarizeCarStatsSheet([values[0], ['x', '31/2/2569', '', '', '', '', '']], '2026-12-31'), /แถวที่ 2/);
});

test('the live and admin-sheet datasets never share a source', () => {
  const shared = DATASET_SOURCES.live.filter(s => DATASET_SOURCES.sheet.includes(s));
  assert.deepEqual(shared, []);
  assert.ok(DATASET_SOURCES.live.includes('goodcrm') && DATASET_SOURCES.live.includes('phone') && DATASET_SOURCES.live.includes('car_line_sheet'));
});
