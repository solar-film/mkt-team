import type { Prisma } from '@prisma/client';
import { assignmentData } from './assignment-storage';
import { AssignmentValidationError } from './assignments';

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

  for (const item of input) {
    if (!item || typeof item.title !== 'string' || !item.title.trim()) {
      throw new AssignmentValidationError('กรุณาระบุรายละเอียดของรายการที่ต้องทำ');
    }
    if (item.itemCategory !== 'task' && item.itemCategory !== 'content') {
      throw new AssignmentValidationError('ประเภทของรายการที่ต้องทำไม่ถูกต้อง');
    }
    const assignments = await assignmentData(item, db, true);
    const deadline = item.deadline ? new Date(item.deadline) : null;
    if (deadline && Number.isNaN(deadline.getTime())) throw new AssignmentValidationError('วันที่ของรายการที่ต้องทำไม่ถูกต้อง');
    const shared = { title: item.title.trim(), meetingId, ...assignments };

    if (item.id) {
      const existing = item.itemCategory === 'task'
        ? await db.task.findFirst({ where: { id: item.id, meetingId } })
        : await db.content.findFirst({ where: { id: item.id, meetingId } });
      if (!existing) throw new AssignmentValidationError('ไม่พบรายการที่เกี่ยวข้องกับการประชุมนี้');
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
