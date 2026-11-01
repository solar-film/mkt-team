import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import { MEMBER_HEADER, clientIp, lockMessage, lockedUntil, readCookie, recordAttempt } from '@/lib/member-auth';
import {
  KPI_HUB_COOKIE, KPI_HUB_PATH, KPI_HUB_SECONDS, issuePass, kpiHubLinks, kpiHubPassword, passValid, passwordMatches,
  type KpiHubState,
} from '@/lib/kpi-hub';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };
const passCookie = (maxAge: number) => ({
  httpOnly: true, sameSite: 'strict' as const, secure: process.env.NODE_ENV === 'production', path: KPI_HUB_PATH, maxAge,
});

// The proxy has already checked the member session and set this header.
const memberOf = (request: Request) => request.headers.get(MEMBER_HEADER) ?? '';

export async function GET(request: Request) {
  const password = kpiHubPassword();
  let state: KpiHubState;
  if (!password) state = { status: 'not-configured' };
  else if (passValid(readCookie(request, KPI_HUB_COOKIE), memberOf(request), password)) state = { status: 'open', links: kpiHubLinks() };
  else state = { status: 'locked' };
  return NextResponse.json(state, { headers });
}

/** Wrong answers use 403, not 401: the page treats 401 as an expired member login. */
export async function POST(request: Request) {
  const password = kpiHubPassword();
  if (!password) return NextResponse.json({ error: 'ยังไม่ได้ตั้งรหัสของหน้านี้' }, { status: 503, headers });
  const memberId = memberOf(request);
  try {
    const body = await readJsonBody(request);
    const input = typeof body.password === 'string' ? body.password.slice(0, 200) : '';

    const until = await lockedUntil(prisma, { kind: 'kpi-hub', memberId, ip: clientIp(request) });
    if (until) {
      await recordAttempt(prisma, request, { kind: 'kpi-hub', memberId, success: false, reason: 'locked' });
      return NextResponse.json({ error: lockMessage(until) }, { status: 429, headers });
    }
    if (!passwordMatches(input, password)) {
      await recordAttempt(prisma, request, { kind: 'kpi-hub', memberId, success: false, reason: 'wrong password' });
      return NextResponse.json({ error: 'รหัสไม่ถูกต้อง' }, { status: 403, headers });
    }

    await recordAttempt(prisma, request, { kind: 'kpi-hub', memberId, success: true, reason: 'ok' });
    const state: KpiHubState = { status: 'open', links: kpiHubLinks() };
    const response = NextResponse.json(state, { headers });
    response.cookies.set(KPI_HUB_COOKIE, issuePass(memberId, password), passCookie(KPI_HUB_SECONDS));
    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: 'Invalid request' }, { status: error.status, headers });
    console.error('KPI hub unlock failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'ตรวจรหัสไม่สำเร็จ ลองใหม่อีกครั้ง' }, { status: 500, headers });
  }
}

/** "ล็อกหน้านี้": forgets the pass on this browser. */
export async function DELETE() {
  const response = NextResponse.json({ status: 'locked' } satisfies KpiHubState, { headers });
  response.cookies.set(KPI_HUB_COOKIE, '', passCookie(0));
  return response;
}
