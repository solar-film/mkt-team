import { NextResponse } from 'next/server';
import { secretMatches } from '@/lib/integration-security';
import { windsorConfigured } from '@/lib/windsor';
import { invalidateWorkspace } from '@/lib/workspace-cache';
import { facebookWindow, syncFacebookPosts } from '@/lib/facebook-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Nightly: Facebook page posts of the last 12 days → matched content items → D+7 reach. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 });
  if (!secretMatches(request.headers.get('authorization'), `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!windsorConfigured()) return NextResponse.json({ error: 'WINDSOR_API_KEY is not set' }, { status: 503 });

  const { from, to } = facebookWindow();
  const result = await syncFacebookPosts(from, to, 'cron');
  // New D+7 figures change the สรุปผลงาน & ประเมิน page, which is cached until the next save.
  if (result.d7 > 0) invalidateWorkspace();
  return NextResponse.json({ from, to, ...result }, { status: result.ok ? 200 : 502 });
}
