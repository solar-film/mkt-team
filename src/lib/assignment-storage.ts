import type { PrismaClient } from '@prisma/client';
import { resolveAssignments, type AssignmentInput } from './assignments';

export function assignmentData(input: AssignmentInput, db: Pick<PrismaClient, 'teamMember'>, creating = false) {
  return resolveAssignments(input, ids => db.teamMember.findMany({
    where: ids.length ? { id: { in: ids } } : { id: { not: 'all' }, status: { not: 'inactive' } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  }), creating);
}
