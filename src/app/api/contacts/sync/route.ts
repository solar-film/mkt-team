import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { syncAdminSheets, syncGoodCrm } from '@/lib/contact-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const headers = { 'Cache-Control': 'private, no-store' };
const COOLDOWN_MS = 5 * 60_000;

/** "ดึงล่าสุด" button: members refresh the last week from GOOD CRM and re-read the admin sheets, at most once per five minutes. */
export async function POST() {
  const last = await prisma.contactSyncRun.findFirst({ where: { source: { in: ['goodcrm', 'sheets'] } }, orderBy: { startedAt: 'desc' } });
  if (last && Date.now() - last.startedAt.getTime() < COOLDOWN_MS) {
    return NextResponse.json({ error: 'เพิ่งดึงข้อมูลไป รอสักครู่แล้วลองใหม่' }, { status: 429, headers });
  }
  const today = bangkokDateKey(new Date());
  const crm = await syncGoodCrm(today, 'member');
  const sheets = await syncAdminSheets(today, 'member');
  const ok = crm.ok && sheets.ok;
  const message = [crm.message, sheets.message].filter(Boolean).join(' · ') || null;
  return NextResponse.json({ ok, from: crm.from, to: today, rows: crm.rows + sheets.rows, message, crm, sheets }, { status: ok ? 200 : 502, headers });
}
