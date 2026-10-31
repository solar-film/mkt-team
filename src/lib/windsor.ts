import { prisma } from './prisma';
import { normalizeWindsorRows, PLATFORMS, WINDSOR_FIELDS, type Platform } from './ads-data';

// Windsor.ai REST API: https://connectors.windsor.ai/{connector}?api_key=…&date_from=…&date_to=…&fields=…
// The key travels in the query string (Windsor accepts no header), so URLs are never logged or stored.
const WINDSOR_URL = 'https://connectors.windsor.ai';
const FETCH_TIMEOUT_MS = 50_000;

export const windsorConfigured = () => Boolean(process.env.WINDSOR_API_KEY?.trim());

const isoDay = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** Error text safe to show and store: no API key, one line, bounded length. */
function safeMessage(error: unknown): string {
  const key = process.env.WINDSOR_API_KEY?.trim();
  let message = error instanceof Error ? error.message : String(error);
  if (key) message = message.split(key).join('***');
  return message.replace(/\s+/g, ' ').slice(0, 300);
}

async function fetchWindsor(platform: Platform, from: string, to: string): Promise<unknown> {
  const params = new URLSearchParams({
    api_key: process.env.WINDSOR_API_KEY!.trim(),
    date_from: from,
    date_to: to,
    fields: WINDSOR_FIELDS[platform].fields.join(','),
  });
  const response = await fetch(`${WINDSOR_URL}/${platform}?${params}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => null) as { data?: unknown; error?: unknown } | null;
  if (!response.ok || !body || body.error) {
    const detail = body?.error && typeof body.error === 'object' ? (body.error as { message?: string }).message : body?.error;
    throw new Error(`Windsor ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  return body.data;
}

export interface SyncResult { platform: Platform; ok: boolean; rows: number; message: string | null }

/**
 * Pulls one platform for from..to (YYYY-MM-DD) and replaces that window in AdDaily.
 * Nothing is deleted unless Windsor answered with a data array, so a failed pull keeps old numbers.
 */
export async function syncPlatform(platform: Platform, from: string, to: string, trigger: 'cron' | 'admin'): Promise<SyncResult> {
  const run = await prisma.adSyncRun.create({ data: { platform, trigger, dateFrom: isoDay(from), dateTo: isoDay(to) } });
  try {
    const rows = normalizeWindsorRows(platform, await fetchWindsor(platform, from, to));
    await prisma.$transaction([
      prisma.adDaily.deleteMany({ where: { platform, date: { gte: isoDay(from), lte: isoDay(to) } } }),
      prisma.adDaily.createMany({
        data: rows.map(({ date, ...row }) => ({ ...row, date: isoDay(date), month: date.slice(0, 7) })),
      }),
    ]);
    await prisma.adSyncRun.update({ where: { id: run.id }, data: { ok: true, rows: rows.length, finishedAt: new Date() } });
    return { platform, ok: true, rows: rows.length, message: null };
  } catch (error) {
    const message = safeMessage(error);
    console.error(`Ads sync failed (${platform}):`, message);
    await prisma.adSyncRun.update({ where: { id: run.id }, data: { ok: false, message, finishedAt: new Date() } }).catch(() => {});
    return { platform, ok: false, rows: 0, message };
  }
}

export const syncAllPlatforms = (from: string, to: string, trigger: 'cron' | 'admin') =>
  Promise.all(PLATFORMS.map(platform => syncPlatform(platform, from, to, trigger)));
