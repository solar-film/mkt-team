import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { JWT } from 'google-auth-library';
import { hasAdminSession } from '@/lib/admin-session';
import { CompanyStatsFormatError, parseCompanyStats, type CompanyStats } from '@/lib/company-stats';

export const dynamic = 'force-dynamic';

// Lives under /api/admin because the admin session cookie is scoped to that path.
// Sheet id comes from the environment so it is not published in the public repository.
const RANGES = ["'สรุป'!A1:H80", "'ยอดขาย'!A1:D400"];
const CACHE_SECONDS = 1800; // the sheet is rewritten once each morning

type FailureCode = 'not_configured' | 'sheet_access' | 'sheet_format' | 'unavailable';
class StatsFailure extends Error {
  constructor(readonly code: FailureCode) { super(code); }
}

function credentials() {
  const sheetId = process.env.COMPANY_STATS_SHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  return { sheetId, email, key };
}

async function readSheet(): Promise<CompanyStats> {
  const { sheetId, email, key } = credentials();
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
    const status = (error as { status?: number; response?: { status?: number } }).status
      ?? (error as { response?: { status?: number } }).response?.status;
    console.error('Company stats sheet read failed', { status });
    throw new StatsFailure(status === 403 || status === 404 ? 'sheet_access' : 'unavailable');
  }
  try {
    return parseCompanyStats(valueRanges[0]?.values ?? [], valueRanges[1]?.values ?? []);
  } catch (error) {
    if (error instanceof CompanyStatsFormatError) {
      console.error(error.message);
      throw new StatsFailure('sheet_format');
    }
    throw error;
  }
}

// Server-side Data Cache only; failures are not cached, so a fixed share works on the next try.
const cachedStats = unstable_cache(readSheet, ['company-stats-v1'], { revalidate: CACHE_SECONDS });

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  try {
    return NextResponse.json(await cachedStats(), { headers: NO_STORE });
  } catch (error) {
    const code: FailureCode = error instanceof StatsFailure ? error.code : 'unavailable';
    if (!(error instanceof StatsFailure)) console.error('Company stats failed', error instanceof Error ? error.message : error);
    // The service-account address is not a secret; admins need it to share the sheet.
    const serviceAccount = code === 'sheet_access' ? credentials().email : undefined;
    return NextResponse.json({ error: code, serviceAccount }, { status: 503, headers: NO_STORE });
  }
}
