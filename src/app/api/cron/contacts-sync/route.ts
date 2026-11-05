import { NextResponse } from 'next/server';
import { secretMatches } from '@/lib/integration-security';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { syncAdminSheets, syncGoodCrm } from '@/lib/contact-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Runs once a night just after midnight Thai time, so yesterday is complete when it is copied.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 });
  if (!secretMatches(request.headers.get('authorization'), `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const today = bangkokDateKey(new Date());
  const crm = await syncGoodCrm(today, 'cron');
  const sheets = await syncAdminSheets(today, 'cron');
  return NextResponse.json({ ok: crm.ok && sheets.ok, crm, sheets }, { status: crm.ok && sheets.ok ? 200 : 502 });
}
