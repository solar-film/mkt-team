import type { PrismaClient } from '@prisma/client';
import { memberSelectionLabel, parseSelection } from './assignments';

interface AssignedRecord {
  memberId: string;
  memberIds?: string[];
  member?: { id: string; name: string } | null;
}

const selectedMembers = (record: AssignedRecord) => parseSelection(record.memberIds?.length ? record.memberIds : record.memberId);

export async function notificationMembers(records: AssignedRecord[], db: Pick<PrismaClient, 'teamMember'>) {
  const members = new Map<string, { id: string; name: string }>();
  records.forEach(record => {
    if (record.member) members.set(record.member.id, record.member);
  });
  const missingIds = [...new Set(records.flatMap(selectedMembers).filter(id => id !== 'all' && !members.has(id)))];
  if (missingIds.length) {
    try {
      const assigned = await db.teamMember.findMany({ where: { id: { in: missingIds } }, select: { id: true, name: true } });
      assigned.forEach(member => members.set(member.id, member));
    } catch {
      // Name enrichment must not turn an already-saved record into a failed request.
      console.warn('Unable to load additional assignee names for notification.');
    }
  }
  return [...members.values()];
}

export function notificationMemberLabel(record: AssignedRecord, members: { id: string; name: string }[]) {
  const ids = selectedMembers(record);
  return ids.length ? memberSelectionLabel(ids, members) : record.member?.name || 'ทีมงาน';
}
