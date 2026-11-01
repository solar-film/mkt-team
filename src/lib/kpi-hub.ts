import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * KPI กลาง: a page of links behind its own password, on top of the member login.
 * The password and both links live in the environment (KPI_HUB_PASSWORD, KPI_HUB_SHEET_URL,
 * KPI_HUB_DASHBOARD_URL), never in this public repository, and the links reach the browser
 * only after the password is accepted.
 */
export const KPI_HUB_COOKIE = 'mkt_kpi_hub';
export const KPI_HUB_SECONDS = 7 * 24 * 3600;
/** Only the browser's calls to this API carry the pass. */
export const KPI_HUB_PATH = '/api/kpi-hub';

export interface KpiHubLinks { sheetUrl: string | null; dashboardUrl: string | null }
export type KpiHubState =
  | { status: 'not-configured' }
  | { status: 'locked' }
  | { status: 'open'; links: KpiHubLinks };

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Hashing both sides first keeps the comparison constant-time whatever the lengths. */
export function passwordMatches(input: string, password: string): boolean {
  return password.length > 0 && timingSafeEqual(digest(input), digest(password));
}

// Keyed by the password, so changing KPI_HUB_PASSWORD locks every browser out of the page again.
const signature = (memberId: string, expires: number, password: string) =>
  createHmac('sha256', `kpi-hub:${password}`).update(`${memberId}.${expires}`).digest('base64url');

/** "<expiry seconds>_<signature>": fits the cookie format readCookie accepts. */
export function issuePass(memberId: string, password: string, now = Date.now()): string {
  const expires = Math.floor(now / 1000) + KPI_HUB_SECONDS;
  return `${expires}_${signature(memberId, expires, password)}`;
}

/** A pass opens the page only for the member it was issued to, until it expires. */
export function passValid(pass: string | null, memberId: string, password: string, now = Date.now()): boolean {
  if (!pass || !password) return false;
  const cut = pass.indexOf('_');
  const expires = Number(pass.slice(0, cut));
  if (cut < 1 || !Number.isInteger(expires) || expires * 1000 <= now) return false;
  const given = Buffer.from(pass.slice(cut + 1));
  const wanted = Buffer.from(signature(memberId, expires, password));
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** Accepts only https links, so a mistyped setting cannot become a javascript: link. */
export function httpsUrl(value: string | undefined): string | null {
  try {
    const url = new URL(value?.trim() ?? '');
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function kpiHubLinks(env: Record<string, string | undefined> = process.env): KpiHubLinks {
  return { sheetUrl: httpsUrl(env.KPI_HUB_SHEET_URL), dashboardUrl: httpsUrl(env.KPI_HUB_DASHBOARD_URL) };
}

export const kpiHubPassword = (env: Record<string, string | undefined> = process.env) => env.KPI_HUB_PASSWORD?.trim() ?? '';
