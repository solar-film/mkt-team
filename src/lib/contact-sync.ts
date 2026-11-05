import { JWT } from 'google-auth-library';
import { prisma } from './prisma';
import {
  ADMIN_SHEET_SOURCE, CAR_STATS_SOURCE, mergeCarLine, normalizeGoodCrmRows, summarizeAdminSheet, summarizeCarLineDaily, summarizeCarStatsSheet,
  type ContactRow, type PhoneUpload, type SheetSummary,
} from './contact-data';

// GOOD CRM (a separate Supabase project) exposes public.mkt_contact_daily(p_key, p_from, p_to):
// per day × platform × account counts only, guarded by GOOD_CRM_STATS_KEY (only its hash lives there).
const FETCH_TIMEOUT_MS = 30_000;
/** Contacts arrive all day; re-reading a week keeps late-day messages and backfills a missed night. */
export const REFRESH_DAYS = 7;
/** GOOD CRM started recording intake days in September 2026; the first pull copies everything since. */
const BACKFILL_FROM = '2026-09-01';

export const goodCrmConfigured = () =>
  Boolean(process.env.GOOD_CRM_URL?.trim() && process.env.GOOD_CRM_PUBLISHABLE_KEY?.trim() && process.env.GOOD_CRM_STATS_KEY?.trim());

const isoDay = (value: string) => new Date(`${value}T00:00:00.000Z`);

function safeMessage(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [process.env.GOOD_CRM_STATS_KEY, process.env.GOOD_CRM_PUBLISHABLE_KEY]) {
    if (secret?.trim()) message = message.split(secret.trim()).join('***');
  }
  return message.replace(/\s+/g, ' ').slice(0, 300);
}

async function fetchGoodCrm(from: string, to: string): Promise<{ rows: ContactRow[]; unlabelled: number }> {
  const base = process.env.GOOD_CRM_URL!.trim().replace(/\/$/, '');
  const apikey = process.env.GOOD_CRM_PUBLISHABLE_KEY!.trim();
  const response = await fetch(`${base}/rest/v1/rpc/mkt_contact_daily`, {
    method: 'POST',
    headers: { apikey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key: process.env.GOOD_CRM_STATS_KEY!.trim(), p_from: from, p_to: to }),
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const detail = body && typeof body === 'object' ? (body as { message?: string }).message : null;
    throw new Error(`GOOD CRM ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  const rows = normalizeGoodCrmRows(body);
  return { rows, unlabelled: Array.isArray(body) ? body.length - rows.length : 0 };
}

// LINE @maholan comes from the CAR_Line_Daily sheet (see contact-data.ts), read with the site's
// existing service account. The sheet id stays in the environment, out of this public repository.
const CAR_LINE_SOURCE = 'car_line_sheet';

const serviceAccountConfigured = () => Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);

const carLineConfigured = () => Boolean(process.env.CAR_LINE_SHEET_ID?.trim() && serviceAccountConfigured());

const sheetsClient = () => new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

async function fetchCarLineSheet() {
  const client = sheetsClient();
  // Column C holds customer IDs and is skipped on purpose.
  const query = ["'CAR_Line_Daily'!A:A", "'CAR_Line_Daily'!D:E"].map(range => `ranges=${encodeURIComponent(range)}`).join('&');
  const response = await client.request<{ valueRanges?: { values?: unknown[][] }[] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(process.env.CAR_LINE_SHEET_ID!.trim())}/values:batchGet?${query}`,
    timeout: 15_000,
  });
  const [kinds, days] = (response.data.valueRanges ?? []).map(range => range.values ?? []);
  return summarizeCarLineDaily(kinds ?? [], days ?? []);
}

export interface ContactSyncResult { ok: boolean; from: string; to: string; rows: number; message: string | null }

/**
 * Copies GOOD CRM counts (and LINE @maholan from CAR_Line_Daily) for from..to into ContactDaily,
 * replacing that window. Old numbers stay if the pull fails.
 */
export async function syncGoodCrm(to: string, trigger: 'cron' | 'member', fromOverride?: string): Promise<ContactSyncResult> {
  let from = fromOverride;
  if (!from) {
    const [crm, sheetAny] = await Promise.all([
      prisma.contactDaily.findFirst({ where: { source: 'goodcrm' }, select: { id: true } }),
      prisma.contactDaily.findFirst({ where: { source: CAR_LINE_SOURCE }, select: { id: true } }),
    ]);
    const start = isoDay(to);
    start.setUTCDate(start.getUTCDate() - (REFRESH_DAYS - 1));
    // The first pull of either source copies its whole history.
    from = crm && (sheetAny || !carLineConfigured()) ? start.toISOString().slice(0, 10) : BACKFILL_FROM;
  }
  const window = { gte: isoDay(from), lte: isoDay(to) };
  const run = await prisma.contactSyncRun.create({ data: { source: 'goodcrm', trigger, dateFrom: isoDay(from), dateTo: isoDay(to) } });
  try {
    if (!goodCrmConfigured()) throw new Error('ยังไม่ได้ตั้งค่า GOOD_CRM_URL / GOOD_CRM_PUBLISHABLE_KEY / GOOD_CRM_STATS_KEY');
    const [{ rows: crmRows, unlabelled }, sheet] = await Promise.all([
      fetchGoodCrm(from, to),
      carLineConfigured() ? fetchCarLineSheet().catch((error: unknown) => error instanceof Error ? error : new Error(String(error))) : null,
    ]);
    const sheetError = sheet instanceof Error ? sheet : null;
    const sheetData = sheet instanceof Error ? null : sheet;
    if (sheetError) console.error('CAR_Line_Daily read failed:', safeMessage(sheetError));
    const stored = sheetData ? [] : await prisma.contactDaily.findMany({ where: { source: CAR_LINE_SOURCE, date: window }, select: { date: true } });
    const merged = mergeCarLine(crmRows, sheetData, { from, to }, new Set(stored.map(r => r.date.toISOString().slice(0, 10))));
    const toData = (rows: ContactRow[], source: string) =>
      rows.map(({ date, ...row }) => ({ ...row, date: isoDay(date), month: date.slice(0, 7), source }));
    await prisma.$transaction([
      prisma.contactDaily.deleteMany({ where: { source: merged.sheet ? { in: ['goodcrm', CAR_LINE_SOURCE] } : 'goodcrm', date: window } }),
      prisma.contactDaily.createMany({ data: [...toData(merged.goodcrm, 'goodcrm'), ...toData(merged.sheet ?? [], CAR_LINE_SOURCE)] }),
    ]);
    const notes = [
      unlabelled ? `ข้าม ${unlabelled} แถวของบัญชีที่ GOOD CRM ยังไม่ได้ระบุบริษัท` : '',
      sheetError ? `อ่าน CAR_Line_Daily ไม่ได้ (LINE @maholan คงตัวเลขเดิม): ${safeMessage(sheetError)}` : '',
      !carLineConfigured() ? 'ยังไม่ได้ตั้ง CAR_LINE_SHEET_ID: LINE @maholan ใช้ตัวเลข GOOD CRM' : '',
    ].filter(Boolean);
    const message = notes.length ? notes.join(' · ').slice(0, 300) : null;
    const rows = merged.goodcrm.length + (merged.sheet?.length ?? 0);
    await prisma.contactSyncRun.update({ where: { id: run.id }, data: { ok: true, rows, message, finishedAt: new Date() } });
    return { ok: true, from, to, rows, message };
  } catch (error) {
    const message = safeMessage(error);
    console.error('Contact sync failed:', message);
    await prisma.contactSyncRun.update({ where: { id: run.id }, data: { ok: false, message, finishedAt: new Date() } }).catch(() => {});
    return { ok: false, from, to, rows: 0, message };
  }
}

/** Replaces phone rows of the uploaded companies inside the file's date range. */
export async function savePhoneUpload(upload: PhoneUpload, fileName: string): Promise<number> {
  const run = await prisma.contactSyncRun.create({
    data: { source: 'phone', trigger: 'upload', dateFrom: isoDay(upload.from), dateTo: isoDay(upload.to), message: fileName.slice(0, 120) || null },
  });
  try {
    await prisma.$transaction([
      prisma.contactDaily.deleteMany({
        where: { source: 'phone', company: { in: upload.companies }, date: { gte: isoDay(upload.from), lte: isoDay(upload.to) } },
      }),
      prisma.contactDaily.createMany({
        data: upload.rows.map(r => ({
          date: isoDay(r.date), month: r.date.slice(0, 7), channel: 'phone', company: r.company,
          account: r.account.trim(), contacts: r.contacts, newContacts: null, source: 'phone',
        })),
      }),
    ]);
    await prisma.contactSyncRun.update({ where: { id: run.id }, data: { ok: true, rows: upload.rows.length, finishedAt: new Date() } });
    return upload.rows.length;
  } catch (error) {
    await prisma.contactSyncRun.update({ where: { id: run.id }, data: { ok: false, message: safeMessage(error), finishedAt: new Date() } }).catch(() => {});
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// Admin lead sheets (dataset `sheet`). Sheet ids stay in the environment, out of this public repository:
// ADMIN_REPORT_SHEET_ID = คิวเชลล์_admin_report (tab #สถิตการติดต่อ), CAR_CRM_SHEET_ID = CAR_CRM (tab สถิตการติดต่อ).

const ADMIN_TAB = '#สถิตการติดต่อ';
/** Only the column groups summarizeAdminSheet reads (date, GFS and MHL totals, the Tel/Line/FB/Walk In block with its headers): 19 of the tab's 92 columns, each placed at its real index. */
const ADMIN_COLUMNS: readonly (readonly [string, number])[] = [['A:A', 0], ['G:K', 6], ['P:T', 15], ['AU:BB', 46]];
const CAR_STATS_RANGE = "'สถิตการติดต่อ'!A:G";
/** The admin sheet is large and formula-heavy; the whole tab timed out at 20 s on the first live read. */
const SHEET_TIMEOUT_MS = 40_000;
/** Both sheets start in November 2023. */
const SHEETS_FROM = '2023-11-01';
const SHEETS_SOURCE = 'sheets';

export const adminSheetsConfigured = () =>
  Boolean((process.env.ADMIN_REPORT_SHEET_ID?.trim() || process.env.CAR_CRM_SHEET_ID?.trim()) && serviceAccountConfigured());

async function readRange(sheetId: string, range: string): Promise<unknown[][]> {
  const response = await sheetsClient().request<{ values?: unknown[][] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}`,
    timeout: SHEET_TIMEOUT_MS,
  });
  return response.data.values ?? [];
}

/** Reads the admin tab's needed column groups in one batchGet and rebuilds rows with the original column indexes. */
async function readAdminColumns(sheetId: string): Promise<unknown[][]> {
  const query = ADMIN_COLUMNS.map(([cols]) => `ranges=${encodeURIComponent(`'${ADMIN_TAB}'!${cols}`)}`).join('&');
  const response = await sheetsClient().request<{ valueRanges?: { values?: unknown[][] }[] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values:batchGet?${query}`,
    timeout: SHEET_TIMEOUT_MS,
  });
  const rows: unknown[][] = [];
  (response.data.valueRanges ?? []).forEach((part, index) => {
    const start = ADMIN_COLUMNS[index]?.[1] ?? 0;
    (part.values ?? []).forEach((cells, r) => {
      const row = rows[r] ?? (rows[r] = []);
      cells.forEach((cell, c) => { row[start + c] = cell; });
    });
  });
  return rows;
}

/** Admins correct past days in the sheets, so every pull replaces that source's whole history. */
async function replaceSource(source: string, rows: ContactRow[]) {
  const data = rows.map(({ date, ...row }) => ({ ...row, date: isoDay(date), month: date.slice(0, 7), source }));
  await prisma.$transaction(async tx => {
    await tx.contactDaily.deleteMany({ where: { source } });
    for (let i = 0; i < data.length; i += 2_000) await tx.contactDaily.createMany({ data: data.slice(i, i + 2_000) });
  }, { timeout: 60_000 });
}

/**
 * Copies both admin sheets into ContactDaily (sources admin_sheet / car_stats_sheet). Each sheet is read and
 * replaced on its own, so one failing leaves the other's fresh copy and the failed one's previous numbers.
 */
export async function syncAdminSheets(to: string, trigger: 'cron' | 'member'): Promise<ContactSyncResult> {
  const run = await prisma.contactSyncRun.create({ data: { source: SHEETS_SOURCE, trigger, dateFrom: isoDay(SHEETS_FROM), dateTo: isoDay(to) } });
  const jobs: { id: string | undefined; read: (id: string) => Promise<unknown[][]>; source: string; label: string; parse: (values: unknown[][], upto: string) => SheetSummary }[] = [
    { id: process.env.ADMIN_REPORT_SHEET_ID?.trim(), read: readAdminColumns, source: ADMIN_SHEET_SOURCE, label: '#สถิตการติดต่อ (GFS/MHL)', parse: summarizeAdminSheet },
    { id: process.env.CAR_CRM_SHEET_ID?.trim(), read: id => readRange(id, CAR_STATS_RANGE), source: CAR_STATS_SOURCE, label: 'สถิตการติดต่อ (CAR CRM)', parse: summarizeCarStatsSheet },
  ];
  const notes: string[] = [];
  let rows = 0;
  let failed = 0;
  if (!serviceAccountConfigured()) { notes.push('ยังไม่ได้ตั้งค่า service account ของ Google'); failed = jobs.length; }
  else {
    // Both sheets are fetched at once; the database is written one source at a time.
    const reads = jobs.map(job => (job.id ? job.read(job.id).then(values => job.parse(values, to)) : Promise.reject(new Error(`ยังไม่ได้ตั้งรหัสชีต ${job.label}`))));
    const settled = await Promise.allSettled(reads);
    for (const [index, job] of jobs.entries()) {
      const outcome = settled[index];
      try {
        if (outcome.status === 'rejected') throw outcome.reason;
        const summary = outcome.value;
        await replaceSource(job.source, summary.rows);
        rows += summary.rows.length;
        if (summary.duplicateDays.length) notes.push(`${job.label}: วันที่ซ้ำ ${summary.duplicateDays.slice(0, 3).join(', ')} รวมยอดทุกแถว`);
      } catch (error) {
        failed++;
        const message = safeMessage(error);
        console.error(`${job.label} sync failed:`, message);
        notes.push(`${job.label}: ${message}`);
      }
    }
  }
  const ok = failed === 0;
  const message = notes.length ? notes.join(' · ').slice(0, 300) : null;
  await prisma.contactSyncRun.update({ where: { id: run.id }, data: { ok, rows, message, finishedAt: new Date() } }).catch(() => {});
  return { ok, from: SHEETS_FROM, to, rows, message };
}
