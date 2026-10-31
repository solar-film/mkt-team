import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, adminConfigured, createAdminSession, hasAdminSession } from '@/lib/admin-session';
import { secretMatches } from '@/lib/integration-security';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import { prisma } from '@/lib/prisma';
import { clientIp, lockMessage, lockedUntil, recordAttempt } from '@/lib/member-auth';

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: hasAdminSession(request) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  if (!adminConfigured()) return NextResponse.json({ error: 'Admin access is not configured' }, { status: 503 });
  try {
    const { password } = await readJsonBody(request);
    const until = await lockedUntil(prisma, { kind: 'admin', ip: clientIp(request) });
    if (until) {
      await recordAttempt(prisma, request, { kind: 'admin', success: false, reason: 'locked' });
      return NextResponse.json({ error: lockMessage(until) }, { status: 429 });
    }
    if (typeof password !== 'string' || password.length > 256 || !secretMatches(password, process.env.ADMIN_PASSWORD!)) {
      await recordAttempt(prisma, request, { kind: 'admin', success: false, reason: 'wrong password' });
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }
    await recordAttempt(prisma, request, { kind: 'admin', success: true, reason: 'ok' });
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(ADMIN_COOKIE, createAdminSession(), {
      httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
      path: '/api/admin', maxAge: ADMIN_SESSION_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: 'Invalid request' }, { status: error.status });
    console.error('Admin login failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Admin login failed' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/admin', maxAge: 0 });
  return response;
}
