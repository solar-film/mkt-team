import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, adminConfigured, createAdminSession, hasAdminSession } from '@/lib/admin-session';
import { secretMatches } from '@/lib/integration-security';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: hasAdminSession(request) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  if (!adminConfigured()) return NextResponse.json({ error: 'Admin access is not configured' }, { status: 503 });
  try {
    const { password } = await readJsonBody(request);
    if (typeof password !== 'string' || password.length > 256 || !secretMatches(password, process.env.ADMIN_PASSWORD!)) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(ADMIN_COOKIE, createAdminSession(), {
      httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
      path: '/api/admin', maxAge: ADMIN_SESSION_SECONDS,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: error instanceof RequestBodyError ? error.status : 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/admin', maxAge: 0 });
  return response;
}
