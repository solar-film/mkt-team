import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasAdminSession } from '@/lib/admin-session';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { daysInMonth, isMonthKey, isPlatform } from '@/lib/ads-data';
import { syncPlatform, windsorConfigured } from '@/lib/windsor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const headers = { 'Cache-Control': 'private, no-store' };

/** Recent Windsor pulls, newest first, for the admin panel. */
export async function GET(request: Request) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  try {
    const runs = await prisma.adSyncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 30 });
    return NextResponse.json({
      configured: windsorConfigured(),
      runs: runs.map(r => ({
        id: r.id, platform: r.platform, trigger: r.trigger, ok: r.ok, rows: r.rows, message: r.message,
        dateFrom: r.dateFrom.toISOString().slice(0, 10), dateTo: r.dateTo.toISOString().slice(0, 10),
        startedAt: r.startedAt.toISOString(),
      })),
    }, { headers });
  } catch (error) {
    console.error('Ads sync log failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'โหลดประวัติไม่สำเร็จ' }, { status: 500, headers });
  }
}

/** Admin backfill: pulls one platform for one calendar month (the page loops over months). */
export async function POST(request: Request) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (!windsorConfigured()) return NextResponse.json({ error: 'ยังไม่ได้ตั้ง WINDSOR_API_KEY บน Vercel' }, { status: 503, headers });
  try {
    const body = await readJsonBody(request) as { platform?: unknown; month?: unknown };
    if (!isPlatform(body.platform) || !isMonthKey(body.month)) {
      return NextResponse.json({ error: 'ต้องระบุ platform และ month (YYYY-MM)' }, { status: 400, headers });
    }
    const today = bangkokDateKey(new Date());
    if (body.month > today.slice(0, 7)) return NextResponse.json({ error: 'เดือนนี้ยังไม่ถึง' }, { status: 400, headers });
    const from = `${body.month}-01`;
    const lastDay = `${body.month}-${String(daysInMonth(body.month)).padStart(2, '0')}`;
    const result = await syncPlatform(body.platform, from, lastDay < today ? lastDay : today, 'admin');
    return NextResponse.json(result, { status: result.ok ? 200 : 502, headers });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    console.error('Ads backfill failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'ดึงข้อมูลไม่สำเร็จ' }, { status: 500, headers });
  }
}
