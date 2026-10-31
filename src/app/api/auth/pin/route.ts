import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import {
  MEMBER_COOKIE, clientIp, hashPin, lockMessage, lockedUntil, readCookie, recordAttempt, revokeMemberSessions,
  sessionMemberId, validPin, verifyPin, weakPin,
} from '@/lib/member-auth';

export const dynamic = 'force-dynamic';

/** A signed-in member changes their own PIN; every other device is signed out. */
export async function POST(request: Request) {
  try {
    const token = readCookie(request, MEMBER_COOKIE);
    const memberId = await sessionMemberId(prisma, token);
    if (!memberId) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบใหม่' }, { status: 401 });

    const { currentPin, newPin } = await readJsonBody(request);
    if (!validPin(newPin)) return NextResponse.json({ error: 'PIN ใหม่ต้องเป็นตัวเลข 6 หลัก' }, { status: 400 });
    if (weakPin(newPin)) return NextResponse.json({ error: 'PIN ใหม่เดาง่ายเกินไป (เลขซ้ำหรือเรียงกัน)' }, { status: 400 });

    const until = await lockedUntil(prisma, { kind: 'member', memberId, ip: clientIp(request) });
    if (until) return NextResponse.json({ error: lockMessage(until) }, { status: 429 });

    const credential = await prisma.memberCredential.findUnique({ where: { memberId }, select: { pinHash: true } });
    if (!(await verifyPin(validPin(currentPin) ? currentPin : '', credential?.pinHash))) {
      await recordAttempt(prisma, request, { kind: 'member', memberId, success: false, reason: 'wrong pin (change)' });
      return NextResponse.json({ error: 'PIN ปัจจุบันไม่ถูกต้อง' }, { status: 401 });
    }

    await prisma.memberCredential.update({ where: { memberId }, data: { pinHash: await hashPin(newPin) } });
    await revokeMemberSessions(prisma, memberId, token);
    await recordAttempt(prisma, request, { kind: 'member', memberId, success: true, reason: 'pin changed' });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: 'Invalid request' }, { status: error.status });
    console.error('PIN change failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'เปลี่ยน PIN ไม่สำเร็จ' }, { status: 500 });
  }
}
