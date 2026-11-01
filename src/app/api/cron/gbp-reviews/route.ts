import { NextResponse } from 'next/server';
import { secretMatches } from '@/lib/integration-security';
import { getGbpSyncInfo, syncGbpReviews } from '@/lib/gbp-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Daily 07:00 Bangkok time (00:00 UTC): Pull live Google Maps stats + 10 latest reviews/business into Supabase. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 });
  if (!secretMatches(request.headers.get('authorization'), `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const info = await getGbpSyncInfo();
  if (!info.configured) {
    return NextResponse.json({ skipped: true, reason: 'Google Service Account is not configured yet' });
  }

  const result = await syncGbpReviews();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
