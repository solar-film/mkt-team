import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasAdminSession } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  try {
    const [attempts, members] = await Promise.all([
      prisma.loginAttempt.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.teamMember.findMany({ select: { id: true, name: true } }),
    ]);
    const names = new Map(members.map(member => [member.id, member.name]));
    return NextResponse.json(attempts.map(attempt => ({
      ...attempt, memberName: attempt.memberId ? names.get(attempt.memberId) ?? null : null,
    })), { headers });
  } catch (error) {
    console.error('Login log failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Failed to load login log' }, { status: 500, headers });
  }
}
