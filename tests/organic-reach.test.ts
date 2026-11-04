import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './route-harness';

function service(options: { createFails?: boolean; promotionFails?: boolean } = {}) {
  const state = {
    promotions: new Map<string, string | null>([
      ['saved-paid', 'paid'], ['saved-blank', null], ['kept-paid', 'paid'], ['kept-organic', 'organic'],
    ]),
    metrics: new Map<string, number>(),
  };
  const promotionCalls: string[][] = [];
  const transactionOptions: unknown[] = [];
  let active = false;
  const prisma = {
    content: { updateMany: () => { throw new Error('Content write must use the transaction'); } },
    $transaction: async (save: (tx: any) => Promise<unknown>, settings: unknown) => {
      transactionOptions.push(settings);
      const promotions = new Map(state.promotions);
      const metrics = new Map(state.metrics);
      active = true;
      const tx = {
        contentMetric: { create: async ({ data }: any) => {
          assert.equal(active, true);
          if (options.createFails) throw new Error('metric failed');
          metrics.set(data.contentId, data.reach);
          return data;
        } },
        content: { updateMany: async ({ where, data }: any) => {
          assert.equal(active, true);
          const ids = Array.from(where.id.in) as string[];
          promotionCalls.push(ids);
          assert.equal(data.promotion, 'organic');
          if (options.promotionFails) throw new Error('promotion failed');
          for (const id of ids) if (promotions.has(id)) promotions.set(id, data.promotion);
          return { count: ids.length };
        } },
      };
      try {
        const result = await save(tx);
        state.promotions = promotions;
        state.metrics = metrics;
        return result;
      } finally { active = false; }
    },
  };
  const { recordOrganicReach } = loadSource('src/lib/organic-reach.ts', { './prisma': { prisma } });
  return { state, promotionCalls, transactionOptions, recordOrganicReach };
}

test('saved Paid and blank rows become Organic atomically; skipped rows stay and IDs are deduplicated', async () => {
  const s = service();
  const result = { created: 2, kept: 2 };
  const saved = await s.recordOrganicReach(async (tx: any) => {
    await tx.contentMetric.create({ data: { contentId: 'saved-paid', reach: 48 } });
    await tx.contentMetric.create({ data: { contentId: 'saved-blank', reach: 0 } });
    return { result, contentIds: ['saved-paid', 'saved-blank', 'saved-paid'] };
  });
  assert.equal(saved, result);
  assert.deepEqual(s.promotionCalls, [['saved-paid', 'saved-blank']]);
  assert.equal(s.state.promotions.get('saved-paid'), 'organic');
  assert.equal(s.state.promotions.get('saved-blank'), 'organic');
  assert.equal(s.state.promotions.get('kept-paid'), 'paid');
  assert.equal(s.state.promotions.get('kept-organic'), 'organic');
  assert.deepEqual([...s.state.metrics], [['saved-paid', 48], ['saved-blank', 0]]);
  assert.deepEqual(JSON.parse(JSON.stringify(s.transactionOptions)), [{ timeout: 15_000 }]);
});

test('no successfully saved IDs leaves every promotion untouched', async () => {
  const s = service();
  const before = [...s.state.promotions];
  const result = await s.recordOrganicReach(async () => ({ result: 0, contentIds: [] }));
  assert.equal(result, 0);
  assert.deepEqual(s.promotionCalls, []);
  assert.deepEqual([...s.state.promotions], before);
});

test('a failed save callback never classifies a row or commits its staged metric', async () => {
  const s = service();
  await assert.rejects(s.recordOrganicReach(async (tx: any) => {
    await tx.contentMetric.create({ data: { contentId: 'saved-paid', reach: 48 } });
    throw new Error('save failed');
  }), /save failed/);
  assert.deepEqual(s.promotionCalls, []);
  assert.equal(s.state.metrics.size, 0);
  assert.equal(s.state.promotions.get('saved-paid'), 'paid');
});

test('a metric create failure propagates before any promotion write', async () => {
  const s = service({ createFails: true });
  await assert.rejects(s.recordOrganicReach(async (tx: any) => {
    await tx.contentMetric.create({ data: { contentId: 'saved-paid', reach: 48 } });
    return { result: 1, contentIds: ['saved-paid'] };
  }), /metric failed/);
  assert.deepEqual(s.promotionCalls, []);
  assert.equal(s.state.metrics.size, 0);
  assert.equal(s.state.promotions.get('saved-paid'), 'paid');
});

test('a promotion write failure rejects the same transaction and rolls back its new metric', async () => {
  const s = service({ promotionFails: true });
  await assert.rejects(s.recordOrganicReach(async (tx: any) => {
    await tx.contentMetric.create({ data: { contentId: 'saved-paid', reach: 48 } });
    return { result: 1, contentIds: ['saved-paid'] };
  }), /promotion failed/);
  assert.deepEqual(s.promotionCalls, [['saved-paid']]);
  assert.equal(s.state.metrics.size, 0);
  assert.equal(s.state.promotions.get('saved-paid'), 'paid');
});
