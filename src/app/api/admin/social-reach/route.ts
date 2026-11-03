import { NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin-session';
import { windsorConfigured } from '@/lib/windsor';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { backfillParts } from '@/lib/facebook-posts';
import { backfillSocialReach } from '@/lib/social-reach-backfill';
import { invalidateWorkspace } from '@/lib/workspace-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };

/** One seven-day part of a historical Instagram/TikTok pull. Admin session required. */
export async function POST(request: Request) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (!windsorConfigured()) return NextResponse.json({ error: 'ยังไม่ได้ตั้ง WINDSOR_API_KEY บน Vercel' }, { status: 503, headers });
  let body: Record<string, unknown>;
  try { body = await readJsonBody(request); }
  catch (error) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: error instanceof RequestBodyError ? error.status : 400, headers });
  }
  const { platform, month } = body;
  if ((platform !== 'instagram' && platform !== 'tiktok_organic') || typeof month !== 'string') {
    return NextResponse.json({ error: 'ช่องทางหรือเดือนไม่ถูกต้อง' }, { status: 400, headers });
  }
  const now = new Date();
  const parts = backfillParts(month, bangkokDateKey(now));
  const part = body.part === undefined ? 0 : body.part;
  if (!parts.length || typeof part !== 'number' || !Number.isInteger(part) || part < 0 || part >= parts.length) {
    return NextResponse.json({ error: 'เดือนไม่ถูกต้องหรือช่วงวันที่ไม่ถูกต้อง' }, { status: 400, headers });
  }
  const result = await backfillSocialReach(platform, parts[part].from, parts[part].to, now);
  if (result.created + result.filled > 0) invalidateWorkspace();
  return NextResponse.json({ platform, ...parts[part], part, parts: parts.length, ...result }, { status: result.ok ? 200 : 502, headers });
}
