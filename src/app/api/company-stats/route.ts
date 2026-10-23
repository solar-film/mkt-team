import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { JWT } from 'google-auth-library';
import { CompanyStatsFormatError, parseCompanyStats, type CompanyStats } from '@/lib/company-stats';

export const dynamic = 'force-dynamic';

// Figures for the business-structure page. Everyone on the site may see them (approved design,
// 23 Oct 2026), but they are read from the summary sheet at run time and never committed to the
// public repository. The sheet id comes from the environment for the same reason.
const RANGES = ["'สรุป'!A1:H80", "'ยอดขาย'!A1:D400", "'ตั้งค่า'!A1:E60", "'รายเดือน'!A1:F1500"];
const CACHE_SECONDS = 1800; // the sheet is rewritten once each morning

type FailureCode = 'not_configured' | 'sheet_access' | 'sheet_format' | 'unavailable';
class StatsFailure extends Error {
  constructor(readonly code: FailureCode) { super(code); }
}

async function readSheet(): Promise<CompanyStats> {
  const sheetId = process.env.COMPANY_STATS_SHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!sheetId || !email || !key) throw new StatsFailure('not_configured');
  const client = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const query = RANGES.map(range => `ranges=${encodeURIComponent(range)}`).join('&');
  let valueRanges: { values?: unknown[][] }[];
  try {
    const response = await client.request<{ valueRanges?: { values?: unknown[][] }[] }>({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values:batchGet?${query}`,
      timeout: 15_000,
    });
    valueRanges = response.data.valueRanges ?? [];
  } catch (error) {
    const status = (error as { status?: number }).status ?? (error as { response?: { status?: number } }).response?.status;
    console.error('Company stats sheet read failed', { status });
    throw new StatsFailure(status === 403 || status === 404 ? 'sheet_access' : 'unavailable');
  }
  const [summary, sales, settings, monthly] = valueRanges.map(range => range.values ?? []);
  try {
    return parseCompanyStats(summary ?? [], sales ?? [], settings ?? [], monthly ?? []);
  } catch (error) {
    if (error instanceof CompanyStatsFormatError) {
      console.error(error.message);
      throw new StatsFailure('sheet_format');
    }
    throw error;
  }
}

// Server-side Data Cache only; failures are not cached, so a fix in the sheet shows on the next try.
const cachedStats = unstable_cache(readSheet, ['company-stats-v2'], { revalidate: CACHE_SECONDS });

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  try {
    return NextResponse.json(await cachedStats(), { headers: NO_STORE });
  } catch (error) {
    const code: FailureCode = error instanceof StatsFailure ? error.code : 'unavailable';
    if (!(error instanceof StatsFailure)) console.error('Company stats failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: code }, { status: 503, headers: NO_STORE });
  }
}
