import type { PrismaClient } from '@prisma/client';
import { decodeAttachment, validAttachment } from './attachments';

// The login page uploads 200px JPEGs (a few KB); this leaves headroom without allowing full-size photos.
export const MAX_AVATAR_BYTES = 100 * 1024;
export const AVATAR_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Member columns for lists. The Base64 avatar is never selected here; it is served by its own URL. */
export const MEMBER_LIST_SELECT = {
  id: true, name: true, role: true, company: true, status: true, createdAt: true, updatedAt: true,
} as const;

/** The version parameter changes whenever the member row changes, so browsers can cache each URL permanently. */
export function avatarUrl(member: { id: string; updatedAt: Date | string }) {
  return `/api/members/${encodeURIComponent(member.id)}/avatar?v=${new Date(member.updatedAt).getTime()}`;
}

/** Replaces avatar bytes with a URL (or null) by checking only which members have a photo. */
export async function withAvatarUrls<T extends { id: string; updatedAt: Date }>(members: T[], db: Pick<PrismaClient, 'teamMember'>) {
  if (members.length === 0) return [];
  const withPhoto = await db.teamMember.findMany({
    where: { id: { in: members.map(member => member.id) }, AND: [{ avatar: { not: null } }, { avatar: { not: '' } }] },
    select: { id: true },
  });
  const ids = new Set(withPhoto.map(member => member.id));
  return members.map(member => ({ ...member, avatar: ids.has(member.id) ? avatarUrl(member) : null }));
}

/** Accepts clearing the photo, or a small image whose bytes match its declared type. */
export function validAvatar(value: unknown): boolean {
  if (value === null || value === '') return true;
  const decoded = decodeAttachment(value);
  if (!decoded || !AVATAR_IMAGE_TYPES.includes(decoded.type) || decoded.bytes.length > MAX_AVATAR_BYTES) return false;
  return validAttachment('avatar', decoded.type, value);
}
