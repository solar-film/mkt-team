import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/** Save new D+7 figures and classify only the rows actually saved, in one transaction. */
export async function recordOrganicReach<T>(
  save: (tx: Prisma.TransactionClient) => Promise<{ result: T; contentIds: string[] }>,
): Promise<T> {
  return prisma.$transaction(async tx => {
    const saved = await save(tx);
    const contentIds = [...new Set(saved.contentIds)];
    if (contentIds.length) {
      await tx.content.updateMany({
        where: { id: { in: contentIds } },
        data: { promotion: 'organic' },
      });
    }
    return saved.result;
  }, { timeout: 15_000 });
}
