import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MEMBER_COOKIE, readCookie, revokeSession, sessionCookieOptions } from '@/lib/member-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await revokeSession(prisma, readCookie(request, MEMBER_COOKIE));
  } catch (error) {
    // The cookie is still cleared below; report so a stuck session can be investigated.
    console.error('Session revoke failed:', error instanceof Error ? error.message : 'unknown error');
  }
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(MEMBER_COOKIE, '', sessionCookieOptions(0));
  return response;
}
