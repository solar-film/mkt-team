import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasAdminSession } from '@/lib/admin-session';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import { hashPin, recordAttempt, revokeMemberSessions, validPin, weakPin } from '@/lib/member-auth';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };
const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });

export async function GET(request: Request) {
  if (!hasAdminSession(request)) return unauthorized();
  try {
    const members = await prisma.teamMember.findMany({
      where: { id: { not: 'all' } },
      select: { id: true, name: true, role: true, status: true, credential: { select: { updatedAt: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(members.map(({ credential, ...member }) => ({ ...member, pinUpdatedAt: credential?.updatedAt ?? null })), { headers });
  } catch (error) {
    console.error('PIN list failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500, headers });
  }
}

/** Sets or resets a member's PIN; the member is signed out on every device. */
export async function POST(request: Request) {
  if (!hasAdminSession(request)) return unauthorized();
  try {
    const { memberId, pin } = await readJsonBody(request);
    if (typeof memberId !== 'string' || !memberId) return NextResponse.json({ error: 'Member is required' }, { status: 400, headers });
    if (!validPin(pin)) return NextResponse.json({ error: 'PIN ต้องเป็นตัวเลข 6 หลัก' }, { status: 400, headers });
    if (weakPin(pin)) return NextResponse.json({ error: 'PIN เดาง่ายเกินไป (เลขซ้ำหรือเรียงกัน)' }, { status: 400, headers });

    const member = await prisma.teamMember.findUnique({ where: { id: memberId }, select: { id: true } });
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404, headers });

    const pinHash = await hashPin(pin);
    await prisma.memberCredential.upsert({ where: { memberId }, create: { memberId, pinHash }, update: { pinHash } });
    await revokeMemberSessions(prisma, memberId);
    await recordAttempt(prisma, request, { kind: 'admin', memberId, success: true, reason: 'pin set by admin' });
    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: 'Invalid request' }, { status: error.status, headers });
    console.error('PIN update failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'ตั้ง PIN ไม่สำเร็จ' }, { status: 500, headers });
  }
}
