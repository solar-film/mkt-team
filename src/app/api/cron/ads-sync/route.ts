import { NextResponse } from 'next/server';
import { secretMatches } from '@/lib/integration-security';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { syncAllPlatforms, windsorConfigured } from '@/lib/windsor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Ad platforms keep revising the last days (late conversions), so every run re-reads this many days.
const REFRESH_DAYS = 10;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 });
  if (!secretMatches(request.headers.get('authorization'), `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!windsorConfigured()) return NextResponse.json({ error: 'WINDSOR_API_KEY is not set' }, { status: 503 });

  const to = bangkokDateKey(new Date());
  const start = new Date(`${to}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (REFRESH_DAYS - 1));
  const from = start.toISOString().slice(0, 10);

  const results = await syncAllPlatforms(from, to, 'cron');
  return NextResponse.json({ from, to, results }, { status: results.some(r => r.ok) ? 200 : 502 });
}
