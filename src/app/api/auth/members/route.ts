import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MEMBER_LIST_SELECT, withAvatarUrls } from '@/lib/member-avatar';

export const dynamic = 'force-dynamic';

/** The sign-in screen's only public data: who can sign in, with no work records. */
export async function GET() {
  try {
    const members = await prisma.teamMember.findMany({
      where: { id: { not: 'all' }, status: { not: 'inactive' } },
      select: { ...MEMBER_LIST_SELECT, credential: { select: { memberId: true } } },
    });
    const listed = await withAvatarUrls(members, prisma);
    return NextResponse.json(listed.map(({ id, name, role, avatar, credential }) => ({ id, name, role, avatar, hasPin: Boolean(credential) })),
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Sign-in member list failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
  }
}
