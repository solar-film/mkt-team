import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MEMBER_COOKIE, readCookie, sessionMemberId } from '@/lib/member-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const memberId = await sessionMemberId(prisma, readCookie(request, MEMBER_COOKIE));
    if (!memberId) return NextResponse.json({ authenticated: false }, { status: 401, headers });
    return NextResponse.json({ authenticated: true, memberId }, { headers });
  } catch (error) {
    console.error('Session check failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Session check failed' }, { status: 500, headers });
  }
}
