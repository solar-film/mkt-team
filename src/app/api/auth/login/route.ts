import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import {
  MEMBER_COOKIE, clientIp, createSession, lockMessage, lockedUntil, recordAttempt, sessionCookieOptions, validPin, verifyPin,
} from '@/lib/member-auth';

export const dynamic = 'force-dynamic';

const WRONG = 'ชื่อหรือ PIN ไม่ถูกต้อง';

export async function POST(request: Request) {
  try {
    const { memberId, pin } = await readJsonBody(request);
    if (typeof memberId !== 'string' || !memberId || memberId.length > 64 || typeof pin !== 'string' || pin.length > 32) {
      return NextResponse.json({ error: WRONG }, { status: 400 });
    }

    const until = await lockedUntil(prisma, { kind: 'member', memberId, ip: clientIp(request) });
    if (until) {
      await recordAttempt(prisma, request, { kind: 'member', memberId, success: false, reason: 'locked' });
      return NextResponse.json({ error: lockMessage(until) }, { status: 429 });
    }

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId }, select: { id: true, status: true, credential: { select: { pinHash: true } } },
    });
    // Always hash, so a missing member or PIN answers as slowly as a wrong one.
    const matched = await verifyPin(validPin(pin) ? pin : '', member?.credential?.pinHash);
    const active = member && member.status !== 'inactive';
    if (!matched || !active) {
      const reason = !member ? 'unknown member' : !active ? 'inactive' : !member.credential ? 'no pin' : 'wrong pin';
      await recordAttempt(prisma, request, { kind: 'member', memberId, success: false, reason });
      return NextResponse.json({ error: WRONG }, { status: 401 });
    }

    const token = await createSession(prisma, member.id, request);
    await recordAttempt(prisma, request, { kind: 'member', memberId: member.id, success: true, reason: 'ok' });
    const response = NextResponse.json({ authenticated: true, memberId: member.id });
    response.cookies.set(MEMBER_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: 'Invalid request' }, { status: error.status });
    console.error('Login failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
