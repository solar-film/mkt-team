// Shared by the GOOD CRM pull / upload routes (server) and the ข้อมูลการติดต่อ pages (browser):
// no Node or database imports here.
import { shiftMonth } from './ads-data';

/** Fixed order: it is also the chart colour order (validated categorical slots 1-4). */
export const CHANNELS = ['line', 'facebook', 'instagram', 'phone', 'walkin', 'tiktok'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Where a channel's numbers come from in the live dataset; walk-in and TikTok exist only in the admin sheets. */
export const CHANNEL_INFO: Record<Channel, { label: string; color: string; source: 'goodcrm' | 'phone' | 'sheet' }> = {
  line: { label: 'LINE OA', color: '#2a78d6', source: 'goodcrm' },
  facebook: { label: 'FB Chat', color: '#eb6834', source: 'goodcrm' },
  instagram: { label: 'IG', color: '#1baf7a', source: 'goodcrm' },
  phone: { label: 'โทร', color: '#eda100', source: 'phone' },
  walkin: { label: 'Walk-in', color: '#8b5cf6', source: 'sheet' },
  tiktok: { label: 'TikTok', color: '#334155', source: 'sheet' },
};

/**
 * Two datasets with different definitions, never mixed on screen. `live` counts every customer who
 * messaged or called (GOOD CRM, the CAR_Line_Daily sheet, uploaded call logs; since Sep 2026).
 * `sheet` counts the leads the admins record by hand each day: #สถิตการติดต่อ in คิวเชลล์_admin_report
 * (GFS / MHL อาคาร) and สถิตการติดต่อ in CAR_CRM (MHL CAR), both kept since Nov 2023.
 */
export const DATASETS = ['live', 'sheet'] as const;
export type Dataset = (typeof DATASETS)[number];
export const DATASET_INFO: Record<Dataset, { label: string; definition: string }> = {
  live: { label: 'GOOD CRM', definition: 'ทุกคนที่ทักหรือโทรเข้า · 1 การติดต่อ = ลูกค้า 1 คนต่อวันต่อบัญชี' },
  sheet: { label: 'ชีตแอดมิน', definition: 'ลีดที่แอดมินคัดและบันทึกในชีตสถิติการติดต่อ · นับต่อวันต่อช่องทาง' },
};
export const ADMIN_SHEET_SOURCE = 'admin_sheet';
export const CAR_STATS_SOURCE = 'car_stats_sheet';
/** ContactDaily.source values behind each dataset. */
export const DATASET_SOURCES: Record<Dataset, readonly string[]> = {
  live: ['goodcrm', 'car_line_sheet', 'phone'],
  sheet: [ADMIN_SHEET_SOURCE, CAR_STATS_SOURCE],
};
export const isDataset = (value: unknown): value is Dataset => DATASETS.includes(value as Dataset);

/** GOOD CRM keeps GFS as one company, so contacts use these three rather than the four ad brands. */
export const COMPANIES = ['GFS', 'MHL', 'CAR'] as const;
export type Company = (typeof COMPANIES)[number];
export const COMPANY_LABEL: Record<Company, string> = { GFS: 'GFS', MHL: 'MHL อาคาร', CAR: 'MHL CAR' };

export const isChannel = (value: unknown): value is Channel => CHANNELS.includes(value as Channel);
export const isCompany = (value: unknown): value is Company => COMPANIES.includes(value as Company);
export const isDateKey = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export interface ContactRow {
  date: string;
  channel: Channel;
  company: Company;
  account: string;
  contacts: number;
  /** Customers whose first message ever fell on this day; null where the source cannot tell (phone). */
  newContacts: number | null;
}

export interface MonthTotal { month: string; channel: Channel; company: Company; contacts: number }
export interface AdChatDay { date: string; company: Company; messages: number; spend: number }

export interface ContactSync {
  source: 'goodcrm' | 'phone' | 'sheets';
  lastRunAt: string | null;
  lastOk: boolean | null;
  lastMessage: string | null;
  lastOkAt: string | null;
  latestDate: string | null;
}

export interface ContactData {
  configured: boolean;
  dataset: Dataset;
  month: string;
  today: string;
  firstMonth: string | null;
  /** Daily rows for the month, the month before and the same month last year. */
  rows: ContactRow[];
  /** Monthly totals for the 13 months up to `month`. */
  monthly: MonthTotal[];
  /** Facebook ad chats and all ad spend per company and day, for the month and the month before. */
  ads: AdChatDay[];
  sync: ContactSync[];
}

export interface Filter { company: Company | 'all'; channel: Channel | 'all' }

const matches = (row: { company: Company; channel?: Channel }, filter: Filter) =>
  (filter.company === 'all' || row.company === filter.company) && (filter.channel === 'all' || !row.channel || row.channel === filter.channel);

export const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Contacts in a month (optionally up to a day of month, for like-for-like comparisons). */
export function monthContacts(rows: ContactRow[], month: string, filter: Filter, uptoDay?: number): number {
  return sum(rows.filter(r => r.date.startsWith(month) && matches(r, filter) && (uptoDay === undefined || Number(r.date.slice(8)) <= uptoDay)).map(r => r.contacts));
}

export function monthNew(rows: ContactRow[], month: string, filter: Filter): number | null {
  const picked = rows.filter(r => r.date.startsWith(month) && matches(r, filter));
  const known = picked.filter(r => r.newContacts !== null);
  return known.length ? sum(known.map(r => r.newContacts ?? 0)) : null;
}

/** One point per day of `month`, contacts split by channel. */
export function dailyByChannel(rows: ContactRow[], month: string, days: number, filter: Filter) {
  return Array.from({ length: days }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    const point: Record<string, number | string> = { day: i + 1, date };
    for (const channel of CHANNELS) {
      point[channel] = sum(rows.filter(r => r.date === date && r.channel === channel && matches(r, filter)).map(r => r.contacts));
    }
    point.total = sum(CHANNELS.map(c => Number(point[c])));
    return point;
  });
}

/** Company × channel table for one month, with the month before beside it. */
export function companyChannelTable(rows: ContactRow[], month: string, filter: Filter) {
  const prev = shiftMonth(month, -1);
  return COMPANIES.filter(company => filter.company === 'all' || company === filter.company).map(company => {
    const cells = CHANNELS.map(channel => ({
      channel,
      now: monthContacts(rows, month, { company, channel }),
      before: monthContacts(rows, prev, { company, channel }),
    }));
    return { company, cells, total: sum(cells.map(c => c.now)), prevTotal: sum(cells.map(c => c.before)) };
  });
}

/** Per account totals for the month (busiest first). */
export function accountLines(rows: ContactRow[], month: string, filter: Filter) {
  const map = new Map<string, { channel: Channel; company: Company; account: string; contacts: number; newContacts: number | null; days: number }>();
  for (const r of rows) {
    if (!r.date.startsWith(month) || !matches(r, filter)) continue;
    const key = `${r.channel}|${r.company}|${r.account}`;
    const line = map.get(key) ?? { channel: r.channel, company: r.company, account: r.account, contacts: 0, newContacts: null, days: 0 };
    line.contacts += r.contacts;
    if (r.newContacts !== null) line.newContacts = (line.newContacts ?? 0) + r.newContacts;
    if (r.contacts > 0) line.days++;
    map.set(key, line);
  }
  return [...map.values()].sort((a, b) => b.contacts - a.contacts);
}

const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

/** Average contacts per weekday over the days of `month` that are complete (before `today`). */
export function weekdayAverages(rows: ContactRow[], month: string, days: number, today: string, filter: Filter) {
  const buckets = WEEKDAYS.map(label => ({ label, total: 0, days: 0 }));
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    if (date >= today) break;
    const bucket = buckets[new Date(`${date}T00:00:00Z`).getUTCDay()];
    bucket.days++;
    bucket.total += sum(rows.filter(r => r.date === date && matches(r, filter)).map(r => r.contacts));
  }
  // Monday first, the way the team plans its week.
  return [...buckets.slice(1), buckets[0]].map(b => ({ label: b.label, average: b.days ? b.total / b.days : null, days: b.days }));
}

/** Months of the series, oldest first, each split by channel. */
export function monthlyByChannel(monthly: MonthTotal[], month: string, filter: Filter) {
  return Array.from({ length: 13 }, (_, i) => shiftMonth(month, i - 12)).map(m => {
    const point: Record<string, number | string> = { month: m };
    for (const channel of CHANNELS) {
      point[channel] = sum(monthly.filter(t => t.month === m && t.channel === channel && matches(t, filter)).map(t => t.contacts));
    }
    point.total = sum(CHANNELS.map(c => Number(point[c])));
    return point;
  });
}

/** Rows from GOOD CRM, checked field by field: a malformed answer fails the pull instead of storing junk. */
export function normalizeGoodCrmRows(data: unknown): ContactRow[] {
  if (!Array.isArray(data)) throw new Error('GOOD CRM ตอบกลับไม่ใช่รายการ');
  return data.map((item): ContactRow | null => {
    const r = item as Record<string, unknown>;
    const contacts = Number(r.contacts);
    const fresh = Number(r.new_contacts);
    if (!isDateKey(r.day) || !isChannel(r.platform) || r.platform === 'phone' || typeof r.account !== 'string'
      || !Number.isSafeInteger(contacts) || contacts < 0 || !Number.isSafeInteger(fresh) || fresh < 0 || fresh > contacts) {
      throw new Error('GOOD CRM ส่งแถวที่รูปแบบไม่ถูกต้อง');
    }
    // An account GOOD CRM has not labelled yet is kept out rather than filed under a guessed company.
    if (!isCompany(r.company)) return null;
    return { date: r.day, channel: r.platform, company: r.company, account: r.account.slice(0, 60), contacts, newContacts: fresh };
  }).filter((row): row is ContactRow => row !== null);
}

// ---------------------------------------------------------------------------------------------
// LINE @maholan (MHL CAR) from the CAR_Line_Daily sheet that the Line+FB_Chat script writes.
// Since 4 Oct 2026 that script no longer forwards @maholan to GOOD CRM, while this sheet keeps
// one row per customer per Thai day (kind "message") plus a "coverage" row marking when it began.

export const CAR_LINE_ACCOUNT = '@maholan';

/**
 * Counts per day from the sheet's kind (column A) and day (column D); customer IDs are never read.
 * `from` is the first full day the sheet covers: the day after its coverage row started.
 */
export function summarizeCarLineDaily(kinds: unknown[][], days: unknown[][]): { from: string; rows: { date: string; contacts: number }[] } {
  if (String(kinds[0]?.[0] ?? '').trim() !== 'kind' || String(days[0]?.[0] ?? '').trim() !== 'day') {
    throw new Error('CAR_Line_Daily: หัวคอลัมน์ไม่ใช่ kind / day');
  }
  let started = '';
  const counts = new Map<string, number>();
  for (let i = 1; i < kinds.length; i++) {
    const kind = String(kinds[i]?.[0] ?? '').trim();
    if (kind === 'coverage') {
      const at = String(days[i]?.[1] ?? '');
      const day = Number.isNaN(Date.parse(at)) ? '' : new Date(Date.parse(at) + 7 * 3_600_000).toISOString().slice(0, 10);
      if (day && (!started || day < started)) started = day;
    } else if (kind === 'message') {
      const day = String(days[i]?.[0] ?? '').trim();
      if (!isDateKey(day)) throw new Error(`CAR_Line_Daily: แถวที่ ${i + 1} วันที่ไม่ถูกต้อง`);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  }
  if (!started) throw new Error('CAR_Line_Daily: ไม่พบแถว coverage');
  const next = new Date(`${started}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const from = next.toISOString().slice(0, 10);
  const rows = [...counts.entries()].filter(([date]) => date >= from).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, contacts]) => ({ date, contacts }));
  return { from, rows };
}

/**
 * Which rows a pull stores. When the sheet was read, it replaces GOOD CRM's MHL CAR LINE rows from its
 * first full day on. When it could not be read, sheet rows already stored stay, and GOOD CRM rows for
 * those days are left out so the two never overlap.
 */
export function mergeCarLine(
  goodcrm: ContactRow[],
  sheet: { from: string; rows: { date: string; contacts: number }[] } | null,
  window: { from: string; to: string },
  storedSheetDates: Set<string>,
): { goodcrm: ContactRow[]; sheet: ContactRow[] | null } {
  const isCarLine = (r: ContactRow) => r.channel === 'line' && r.company === 'CAR';
  if (!sheet) return { goodcrm: goodcrm.filter(r => !(isCarLine(r) && storedSheetDates.has(r.date))), sheet: null };
  return {
    goodcrm: goodcrm.filter(r => !(isCarLine(r) && r.date >= sheet.from)),
    sheet: sheet.rows.filter(r => r.date >= window.from && r.date <= window.to).map(r => ({
      date: r.date, channel: 'line', company: 'CAR', account: CAR_LINE_ACCOUNT, contacts: r.contacts, newContacts: null,
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Call-log files (CSV exported from the phone system, the same files the ประวัติการโทร sheet uses).
// Parsed in the browser: only per-day counts are sent to the server, never phone numbers.

/** Office lines owned by MHL and MHL CAR; any other line in the files belongs to GFS. */
const PHONE_COMPANY: Record<string, Company> = {
  '0994565294': 'MHL', '0949981234': 'MHL', '0972929488': 'MHL',
  '0994562259': 'CAR', '0959533949': 'CAR',
};

export const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('66') && digits.length >= 10 ? `0${digits.slice(2)}` : digits;
};

export function formatPhone(digits: string): string {
  if (/^02\d{7}$/.test(digits)) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  if (/^0\d{9}$/.test(digits)) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits || 'ไม่ทราบเบอร์';
}

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^﻿/, '');
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}

/** YYYY-MM-DD from "2026-10-31 14:05:00" or "31/10/2026 14:05" (Buddhist years accepted). */
export function callDate(value: string): string | null {
  const text = value.trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  let year: number, month: number, day: number;
  if (match) [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
    if (!match) return null;
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  if (year > 2400) year -= 543;
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isDateKey(key) ? key : null;
}

const INBOUND = /^(in|incoming|inbound)\b|^i$|โทรเข้า|เข้า/i;

export interface PhoneDayRow { date: string; company: Company; account: string; contacts: number }

export interface CallLogSummary {
  rows: PhoneDayRow[];
  from: string;
  to: string;
  companies: Company[];
  calls: number;
  inbound: number;
}

const headerIndex = (header: string[], ...names: string[]) => {
  const squashed = header.map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  return squashed.findIndex(h => names.includes(h));
};

/**
 * Counts incoming callers per day and office line: one caller once per day, the same rule as chats.
 * Throws an Error with a Thai message when the file is not a call log this page understands.
 */
export function summarizeCallLog(text: string): CallLogSummary {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error('ไฟล์ว่างหรือไม่มีแถวข้อมูล');
  const header = table[0];
  const at = {
    start: headerIndex(header, 'startdate', 'start', 'date', 'calldate'),
    dir: headerIndex(header, 'dir', 'direction'),
    local: headerIndex(header, 'localparty', 'local'),
    remote: headerIndex(header, 'remoteparty', 'remote'),
    name: headerIndex(header, 'lastname'),
  };
  const missing = (['start', 'dir', 'local', 'remote'] as const).filter(key => at[key] < 0);
  if (missing.length) {
    throw new Error('ไม่พบคอลัมน์ Start Date, Dir., Local Party, Remote Party ในแถวแรก — ใช้ไฟล์ประวัติการโทรแบบเดียวกับที่นำเข้าชีต');
  }

  const callers = new Map<string, Set<string>>();
  const directions = new Set<string>();
  let calls = 0;
  let inbound = 0;
  let from = '';
  let to = '';
  for (const [index, row] of table.slice(1).entries()) {
    const date = callDate(row[at.start] ?? '');
    if (!date) throw new Error(`แถวที่ ${index + 2}: อ่านวันที่ "${row[at.start] ?? ''}" ไม่ได้`);
    calls++;
    if (!from || date < from) from = date;
    if (!to || date > to) to = date;
    const dir = (row[at.dir] ?? '').trim();
    directions.add(dir);
    if (!INBOUND.test(dir)) continue;
    inbound++;
    const local = normalizePhone(row[at.local] ?? '');
    const company = PHONE_COMPANY[local] ?? (/maholan|มโหฬาร/i.test(at.name >= 0 ? row[at.name] ?? '' : '') ? 'MHL' : 'GFS');
    const key = `${date}|${company}|${formatPhone(local)}`;
    // A hidden caller ID cannot be matched with anything, so each such call counts once.
    const caller = normalizePhone(row[at.remote] ?? '') || `hidden-${index}`;
    const set = callers.get(key) ?? new Set<string>();
    set.add(caller);
    callers.set(key, set);
  }
  if (calls > 0 && inbound === 0) {
    throw new Error(`ไม่พบสายโทรเข้าในคอลัมน์ Dir. (ค่าที่พบ: ${[...directions].slice(0, 6).join(', ') || 'ว่าง'}) — แจ้งลีโอเพื่อเพิ่มค่าที่ใช้`);
  }
  const rows = [...callers.entries()].map(([key, set]) => {
    const [date, company, account] = key.split('|');
    return { date, company: company as Company, account, contacts: set.size };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company) || a.account.localeCompare(b.account));
  const companies = COMPANIES.filter(c => rows.some(r => r.company === c));
  return { rows, from, to, companies, calls, inbound };
}

/** What the upload route accepts; anything else is rejected before touching the database. */
export interface PhoneUpload { from: string; to: string; companies: Company[]; rows: PhoneDayRow[] }

export const MAX_UPLOAD_ROWS = 20_000;

export function validatePhoneUpload(body: unknown): PhoneUpload | string {
  if (!body || typeof body !== 'object') return 'ข้อมูลไม่ถูกต้อง';
  const { from, to, companies, rows } = body as Record<string, unknown>;
  if (!isDateKey(from) || !isDateKey(to) || from > to) return 'ช่วงวันที่ไม่ถูกต้อง';
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 400) return 'ไฟล์ครอบคลุมเกิน 400 วัน กรุณาแบ่งไฟล์';
  if (!Array.isArray(companies) || !companies.length || !companies.every(isCompany)) return 'บริษัทไม่ถูกต้อง';
  if (!Array.isArray(rows) || rows.length > MAX_UPLOAD_ROWS) return 'จำนวนแถวไม่ถูกต้อง';
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') return 'แถวข้อมูลไม่ถูกต้อง';
    const r = row as Record<string, unknown>;
    if (!isDateKey(r.date) || r.date < from || r.date > to) return 'วันที่ในแถวอยู่นอกช่วงของไฟล์';
    if (!isCompany(r.company) || !companies.includes(r.company)) return 'บริษัทในแถวไม่ถูกต้อง';
    if (typeof r.account !== 'string' || !r.account.trim() || r.account.length > 40) return 'เบอร์ปลายทางไม่ถูกต้อง';
    if (!Number.isSafeInteger(r.contacts) || (r.contacts as number) < 0 || (r.contacts as number) > 100_000) return 'จำนวนสายไม่ถูกต้อง';
    const key = `${r.date}|${r.company}|${r.account}`;
    if (seen.has(key)) return 'มีแถวซ้ำในข้อมูล';
    seen.add(key);
  }
  return { from, to, companies: companies as Company[], rows: rows as PhoneDayRow[] };
}

// ---------------------------------------------------------------------------------------------
// Admin lead sheets (dataset `sheet`): the daily lead counts the admins keep by hand, read with the
// site's service account. Only count columns are requested; the sheets' customer data never is.

export const ADMIN_SHEET_ACCOUNT = 'ชีตแอดมิน';
export const CAR_STATS_ACCOUNT = 'ชีต CAR CRM';

export interface SheetSummary { rows: ContactRow[]; from: string | null; to: string | null; duplicateDays: string[] }

type DayCounts = { counts: Partial<Record<Channel, number>>; fresh: number | null; times: number };

const squash = (value: unknown) => String(value ?? '').replace(/\s+/g, '').toLowerCase();

function cellCount(value: unknown, where: string): number {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (!text) return 0;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${where}: "${text}" ไม่ใช่จำนวน`);
  return n;
}

/** Adds a day's counts; the same day typed twice is summed and reported, never stored twice. */
function collect(days: Map<string, DayCounts>, date: string, company: Company, counts: Partial<Record<Channel, number>>, fresh: number | null) {
  const key = `${date}|${company}`;
  const day = days.get(key) ?? { counts: {}, fresh: null, times: 0 };
  for (const [channel, n] of Object.entries(counts) as [Channel, number][]) day.counts[channel] = (day.counts[channel] ?? 0) + n;
  if (fresh !== null) day.fresh = (day.fresh ?? 0) + fresh;
  day.times++;
  days.set(key, day);
}

/**
 * One row per channel with contacts. The sheets keep a single "new customers" figure per company and day,
 * so it rides on the first channel row (chat first); the page shows it per company, not per line.
 */
function toSummary(days: Map<string, DayCounts>): SheetSummary {
  const rows: ContactRow[] = [];
  const duplicateDays = new Set<string>();
  for (const [key, day] of days) {
    const [date, company] = key.split('|') as [string, Company];
    if (day.times > 1) duplicateDays.add(date);
    const account = company === 'CAR' ? CAR_STATS_ACCOUNT : ADMIN_SHEET_ACCOUNT;
    const lines = CHANNELS.filter(c => (day.counts[c] ?? 0) > 0)
      .map((c): ContactRow => ({ date, channel: c, company, account, contacts: day.counts[c] ?? 0, newContacts: null }));
    // A day with new customers but no channel count (a typing gap) keeps the figure on an empty LINE row.
    if (!lines.length && day.fresh) lines.push({ date, channel: 'line', company, account, contacts: 0, newContacts: null });
    if (lines.length && day.fresh !== null) lines[0].newContacts = day.fresh;
    rows.push(...lines);
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company) || a.channel.localeCompare(b.channel));
  return { rows, from: rows[0]?.date ?? null, to: rows.at(-1)?.date ?? null, duplicateDays: [...duplicateDays].sort() };
}

/** Column indexes (0-based) in #สถิตการติดต่อ; checked against the header rows before any number is read. */
const ADMIN_COLUMNS = {
  GFS: { phone: 8, line: 6, facebook: 7, walkin: 49, fresh: 10 },
  MHL: { phone: 17, line: 15, facebook: 16, walkin: 53, fresh: 19 },
} as const;

/**
 * #สถิตการติดต่อ in คิวเชลล์_admin_report (range A1:BB): row 1 names the company blocks, row 2 the columns,
 * then one row per day labelled like "วันพุธ  01/11/23" (dd/mm/yy). Rows after `upto` are pre-filled blanks.
 */
export function summarizeAdminSheet(values: unknown[][], upto: string): SheetSummary {
  const [blocks = [], header = []] = values;
  const expected: [unknown[], number, string][] = [
    [blocks, 8, 'gfs'], [blocks, 17, 'mhl'], [blocks, 46, 'gfs'], [blocks, 50, 'mhl'],
    [header, 0, 'วันที่'], [header, 6, 'line'], [header, 7, 'fb'], [header, 8, 'รวมโทร.'], [header, 10, 'ลค.ใหม่'],
    [header, 15, 'line'], [header, 16, 'fb'], [header, 17, 'รวมโทร.'], [header, 19, 'ลค.ใหม่'], [header, 49, 'walkin'], [header, 53, 'walkin'],
  ];
  const wrong = expected.find(([row, index, label]) => squash(row[index]) !== label);
  if (wrong) throw new Error(`#สถิตการติดต่อ: คอลัมน์ที่ ${wrong[1] + 1} ไม่ใช่ "${wrong[2]}" (ชีตอาจย้ายคอลัมน์)`);
  const days = new Map<string, DayCounts>();
  for (let i = 2; i < values.length; i++) {
    const row = values[i] ?? [];
    const label = String(row[0] ?? '').trim();
    if (!label) continue;
    const match = /(\d{2})\/(\d{2})\/(\d{2})$/.exec(label);
    const date = match ? `20${match[3]}-${match[2]}-${match[1]}` : '';
    if (!isDateKey(date)) throw new Error(`#สถิตการติดต่อ แถวที่ ${i + 1}: อ่านวันที่ "${label}" ไม่ได้`);
    if (date > upto) continue;
    for (const company of ['GFS', 'MHL'] as const) {
      const at = ADMIN_COLUMNS[company];
      const where = `#สถิตการติดต่อ แถวที่ ${i + 1} ${company}`;
      collect(days, date, company, {
        phone: cellCount(row[at.phone], where), line: cellCount(row[at.line], where),
        facebook: cellCount(row[at.facebook], where), walkin: cellCount(row[at.walkin], where),
      }, cellCount(row[at.fresh], where));
    }
  }
  return toSummary(days);
}

const CAR_HEADERS = { date: 'วันที่', phone: 'โทร', line: 'line', facebook: 'fb', tiktok: 'tiktok', walkin: 'walkin' } as const;

/**
 * สถิตการติดต่อ in CAR_CRM (range A:G): a header row, then one row per day ("1/11/2566", Buddhist year)
 * with โทร / Line / FB / Tiktok / WalkIn counts. Typed by staff until 5 Oct 2026, counted from the lead sheet since.
 */
export function summarizeCarStatsSheet(values: unknown[][], upto: string): SheetSummary {
  const header = (values[0] ?? []).map(squash);
  const at = Object.fromEntries(Object.entries(CAR_HEADERS).map(([key, label]) => [key, header.indexOf(label)])) as Record<keyof typeof CAR_HEADERS, number>;
  const missing = (Object.keys(CAR_HEADERS) as (keyof typeof CAR_HEADERS)[]).filter(key => at[key] < 0).map(key => CAR_HEADERS[key]);
  if (missing.length) throw new Error(`สถิตการติดต่อ (CAR CRM): ไม่พบหัวคอลัมน์ ${missing.join(', ')}`);
  const days = new Map<string, DayCounts>();
  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? [];
    const text = String(row[at.date] ?? '').trim();
    if (!text) continue;
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    let year = match ? Number(match[3]) : 0;
    if (year > 2400) year -= 543;
    const date = match ? `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
    if (!isDateKey(date)) throw new Error(`สถิตการติดต่อ (CAR CRM) แถวที่ ${i + 1}: อ่านวันที่ "${text}" ไม่ได้`);
    if (date > upto) continue;
    const where = `สถิตการติดต่อ (CAR CRM) แถวที่ ${i + 1}`;
    collect(days, date, 'CAR', {
      phone: cellCount(row[at.phone], where), line: cellCount(row[at.line], where), facebook: cellCount(row[at.facebook], where),
      tiktok: cellCount(row[at.tiktok], where), walkin: cellCount(row[at.walkin], where),
    }, null);
  }
  return toSummary(days);
}
