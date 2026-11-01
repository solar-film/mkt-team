import { JWT } from 'google-auth-library';
import { prisma } from './prisma';
import { mergeCarLine, normalizeGoodCrmRows, summarizeCarLineDaily, type ContactRow, type PhoneUpload } from './contact-data';

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

const carLineConfigured = () =>
  Boolean(process.env.CAR_LINE_SHEET_ID?.trim() && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);

async function fetchCarLineSheet() {
  const client = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
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
