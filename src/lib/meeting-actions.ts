import type { Prisma } from '@prisma/client';
import { AssignmentValidationError, resolveAssignments } from './assignments';

export async function saveMeetingActions(db: Prisma.TransactionClient, meetingId: string, input: unknown) {
  if (input === undefined) return;
  if (!Array.isArray(input)) throw new AssignmentValidationError('รูปแบบรายการที่ต้องทำไม่ถูกต้อง');

  // Items removed from the meeting form stay on the board with their status and links;
  // they are only detached from this meeting. This runs before new items are created.
  const keptIds = (category: string) => input
    .filter(item => item?.itemCategory === category && typeof item.id === 'string' && item.id)
    .map(item => item.id as string);
  await db.task.updateMany({ where: { meetingId, id: { notIn: keptIds('task') } }, data: { meetingId: null } });
  await db.content.updateMany({ where: { meetingId, id: { notIn: keptIds('content') } }, data: { meetingId: null } });

  // One lookup per distinct member selection and one per existing-item table, instead of per item,
  // so meetings with many action items stay inside the transaction time limit.
  const memberLookups = new Map<string, Promise<{ id: string }[]>>();
  const findMembers = (ids: string[]) => {
    const key = ids.join(',');
    if (!memberLookups.has(key)) {
      memberLookups.set(key, db.teamMember.findMany({
        where: ids.length ? { id: { in: ids } } : { id: { not: 'all' }, status: { not: 'inactive' } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      }));
    }
    return memberLookups.get(key)!;
  };
  const [linkedTasks, linkedContents] = await Promise.all([
    db.task.findMany({ where: { meetingId }, select: { id: true } }),
    db.content.findMany({ where: { meetingId }, select: { id: true } }),
  ]);
  const linkedIds = { task: new Set(linkedTasks.map(row => row.id)), content: new Set(linkedContents.map(row => row.id)) };

  for (const item of input) {
    if (!item || typeof item.title !== 'string' || !item.title.trim()) {
      throw new AssignmentValidationError('กรุณาระบุรายละเอียดของรายการที่ต้องทำ');
    }
    if (item.itemCategory !== 'task' && item.itemCategory !== 'content') {
      throw new AssignmentValidationError('ประเภทของรายการที่ต้องทำไม่ถูกต้อง');
    }
    const assignments = await resolveAssignments(item, findMembers, true);
    const deadline = item.deadline ? new Date(item.deadline) : null;
    if (deadline && Number.isNaN(deadline.getTime())) throw new AssignmentValidationError('วันที่ของรายการที่ต้องทำไม่ถูกต้อง');
    const shared = { title: item.title.trim(), meetingId, ...assignments };

    if (item.id) {
      if (!linkedIds[item.itemCategory as 'task' | 'content'].has(item.id)) throw new AssignmentValidationError('ไม่พบรายการที่เกี่ยวข้องกับการประชุมนี้');
      if (item.itemCategory === 'task') {
        await db.task.update({ where: { id: item.id }, data: { ...shared, deadline } });
      } else {
        await db.content.update({ where: { id: item.id }, data: { ...shared, publishDate: deadline } });
      }
    } else if (item.itemCategory === 'task') {
      await db.task.create({ data: { ...shared, memberId: assignments.memberId!, deadline, status: 'todo', priority: 'medium' } });
    } else {
      await db.content.create({ data: { ...shared, memberId: assignments.memberId!, publishDate: deadline, status: 'draft', platform: 'Facebook', type: 'post' } });
    }
  }
}
