import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decodeAttachment } from '@/lib/attachments'
import { AVATAR_IMAGE_TYPES } from '@/lib/member-avatar'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const member = await prisma.teamMember.findUnique({ where: { id }, select: { avatar: true } });
    const decoded = decodeAttachment(member?.avatar);
    if (!decoded || !AVATAR_IMAGE_TYPES.includes(decoded.type)) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
    }
    return new Response(new Uint8Array(decoded.bytes), { headers: {
      'Content-Type': decoded.type,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      // Avatar URLs carry the member's updatedAt, so a new photo always gets a new URL.
      'Cache-Control': 'private, max-age=31536000, immutable',
    } });
  } catch {
    return NextResponse.json({ error: 'Failed to load avatar' }, { status: 500 });
  }
}
