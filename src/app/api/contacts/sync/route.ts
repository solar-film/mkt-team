import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { syncGoodCrm } from '@/lib/contact-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const headers = { 'Cache-Control': 'private, no-store' };
const COOLDOWN_MS = 5 * 60_000;

/** "ดึงล่าสุด" button: members refresh the last week from GOOD CRM, at most once per five minutes. */
export async function POST() {
  const last = await prisma.contactSyncRun.findFirst({ where: { source: 'goodcrm' }, orderBy: { startedAt: 'desc' } });
  if (last && Date.now() - last.startedAt.getTime() < COOLDOWN_MS) {
    return NextResponse.json({ error: 'เพิ่งดึงข้อมูลไป รอสักครู่แล้วลองใหม่' }, { status: 429, headers });
  }
  const result = await syncGoodCrm(bangkokDateKey(new Date()), 'member');
  return NextResponse.json(result, { status: result.ok ? 200 : 502, headers });
}
