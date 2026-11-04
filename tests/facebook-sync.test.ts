import assert from 'node:assert/strict';
import test from 'node:test';
import * as facebookPosts from '../src/lib/facebook-posts';
import { bangkokDateKey } from '../src/lib/bangkok-date';
import { loadSource } from './route-harness';

const now = new Date('2026-11-03T03:00:00Z');
const row = (id: string, day: string, reach: number | null) => ({
  post_id: `page_${id}`, post_created_time: `${day}T03:00:00Z`, post_message: `ผลงานติดฟิล์ม ${id}`,
  post_total_media_view_unique: reach, post_reactions_total: 2, post_comments_total: 1,
});
type Metric = { id: string; contentId: string; reach: number | null; likes?: number | null; comments?: number | null; note?: string | null };

/** Uses the real transaction/classification helper; all persistence and Windsor data stay in memory. */
function service(rows: ReturnType<typeof row>[] | null, initialMetrics: Metric[] = []) {
  const contents = new Map((rows ?? []).map(r => {
    const id = r.post_id.slice('page_'.length);
    return [id, { id, title: r.post_message, publishDate: new Date(r.post_created_time),
      link: `https://www.facebook.com/page/posts/${id}`, promotion: 'paid', submittedAt: null as string | null }];
  }));
  const posts = new Map((rows ?? []).map(r => [r.post_id, {
    id: r.post_id, contentId: r.post_id.slice('page_'.length), matchedBy: 'link',
    createdTime: new Date(r.post_created_time), reach: r.post_total_media_view_unique,
  }]));
  const metrics = new Map(initialMetrics.map(m => [m.contentId, { ...m }]));
  const promotions: { ids: string[]; data: Record<string, unknown> }[] = [];
  const runs: any[] = [];
  let inReachTransaction = false;
  const lazy = <T>(execute: () => T) => ({ then: (yes: (value: T) => unknown, no: (error: unknown) => unknown) => Promise.resolve().then(execute).then(yes, no) });
  const prisma: any = {
    adSyncRun: { create: async () => ({ id: 'run' }), update: async ({ data }: any) => { runs.push(data); } },
    facebookPost: {
      findMany: async ({ where }: any) => [...posts.values()].filter(p => {
        if (where.id?.in) return where.id.in.includes(p.id);
        if (where.contentId?.in) return where.contentId.in.includes(p.contentId);
        return p.createdTime >= where.createdTime.gte && p.createdTime <= where.createdTime.lte && p.reach !== null;
      }),
      upsert: ({ where, create, update }: any) => lazy(() => {
        const saved = posts.has(where.id) ? { ...posts.get(where.id)!, ...update } : create;
        posts.set(where.id, saved); return saved;
      }),
    },
    content: {
      findMany: async () => [...contents.values()],
      updateMany: ({ where, data }: any) => lazy(() => {
        const ids = typeof where.id === 'string' ? [where.id] : [...where.id.in];
        if ('promotion' in data) {
          assert.equal(inReachTransaction, true, 'classification shares the successful Reach transaction');
          assert.deepEqual(Object.keys(data), ['promotion'], 'only classification metadata is changed');
          promotions.push({ ids, data: { ...data } });
        }
        for (const id of ids) {
          const content = contents.get(id)!;
          Object.assign(content, data, data.submittedAt ? { submittedAt: data.submittedAt.toISOString() } : {});
        }
        return { count: ids.length };
      }),
    },
    contentMetric: {
      createManyAndReturn: ({ data, skipDuplicates, select }: any) => lazy(() => {
        assert.equal(skipDuplicates, true);
        assert.deepEqual(Object.keys(select), ['contentId']);
        const saved: { contentId: string }[] = [];
        for (const m of data) {
          if (metrics.has(m.contentId)) continue;
          metrics.set(m.contentId, { id: `m-${m.contentId}`, ...m });
          saved.push({ contentId: m.contentId });
        }
        return saved.reverse(); // Prisma does not guarantee returned row order.
      }),
      findMany: async () => [...metrics.values()],
      create: ({ data }: any) => lazy(() => {
        assert.equal(metrics.has(data.contentId), false);
        metrics.set(data.contentId, { id: `m-${data.contentId}`, ...data });
        return { contentId: data.contentId };
      }),
      update: ({ where, data }: any) => lazy(() => {
        const previous = [...metrics.values()].find(m => m.id === where.id)!;
        assert.ok(previous);
        metrics.set(previous.contentId, { ...previous, ...data });
        return { contentId: previous.contentId };
      }),
    },
    $transaction: async (writes: any) => {
      if (typeof writes !== 'function') return Promise.all(writes);
      inReachTransaction = true;
      try { return await writes(prisma); }
      finally { inReachTransaction = false; }
    },
  };
  const organicReach = loadSource('src/lib/organic-reach.ts', { './prisma': { prisma } });
  const module = loadSource('src/lib/facebook-sync.ts', {
    './prisma': { prisma }, './facebook-posts': facebookPosts, './bangkok-date': { bangkokDateKey },
    './organic-reach': organicReach,
    './windsor': { fetchWindsorConnector: async () => rows, safeWindsorMessage: () => 'source failed' },
  }, { AbortSignal, fetch: async () => { throw new Error('network forbidden in tests'); } });
  return { contents, metrics, promotions, runs,
    sync: () => module.syncFacebookPosts('2026-10-01', '2026-11-03', 'cron', now),
    backfill: () => module.backfillFacebookReach('2026-10-01', '2026-11-03', now),
  };
}

test('Facebook daily changes prior Paid to Organic only for returned newly saved D+7 IDs, including a real zero', async () => {
  const s = service([
    row('new', '2026-10-26', 152), row('zero', '2026-10-27', 0), row('kept', '2026-10-26', 456),
    row('young', '2026-11-02', 10), row('missing', '2026-10-26', null),
  ], [{ id: 'typed', contentId: 'kept', reach: 99, note: 'team value' }]);
  const result = await s.sync();
  assert.equal(result.ok, true);
  assert.equal(result.d7, 2);
  assert.equal(s.contents.get('new')?.promotion, 'organic');
  assert.equal(s.contents.get('zero')?.promotion, 'organic');
  for (const id of ['kept', 'young', 'missing']) assert.equal(s.contents.get(id)?.promotion, 'paid', id);
  assert.equal(s.metrics.get('kept')?.reach, 99);
  assert.equal(s.metrics.get('zero')?.reach, 0);
  assert.equal(s.metrics.has('young'), false);
  assert.equal(s.metrics.has('missing'), false);
  assert.deepEqual(s.promotions.flatMap(p => p.ids).sort(), ['new', 'zero']);
});

test('Facebook historical creation and empty fill become Organic, while kept Reach and other fields stay intact', async () => {
  const s = service([row('new', '2026-10-10', 25), row('empty', '2026-10-11', 30), row('kept', '2026-10-12', 40)], [
    { id: 'empty-metric', contentId: 'empty', reach: null, likes: 91, comments: 92, note: 'existing note' },
    { id: 'typed-metric', contentId: 'kept', reach: 77, note: 'typed' },
  ]);
  const result = await s.backfill();
  assert.equal(result.ok, true);
  assert.deepEqual([result.created, result.filled, result.kept], [1, 1, 1]);
  assert.equal(s.contents.get('new')?.promotion, 'organic');
  assert.equal(s.contents.get('empty')?.promotion, 'organic');
  assert.equal(s.contents.get('kept')?.promotion, 'paid');
  assert.deepEqual(s.promotions.flatMap(p => p.ids).sort(), ['empty', 'new']);
  assert.equal(s.metrics.get('empty')?.reach, 30);
  assert.equal(s.metrics.get('empty')?.likes, 91);
  assert.equal(s.metrics.get('empty')?.comments, 92);
  assert.match(s.metrics.get('empty')?.note ?? '', /^existing note · Reach จาก Windsor ย้อนหลัง/);
  assert.equal(s.metrics.get('kept')?.reach, 77);
  assert.equal(s.contents.get('empty')?.link, 'https://www.facebook.com/page/posts/empty');
});

test('Facebook source failure neither records D+7 nor changes Organic/Paid', async () => {
  const s = service(null);
  const result = await s.sync();
  assert.equal(result.ok, false);
  assert.equal(result.d7, 0);
  assert.equal(s.metrics.size, 0);
  assert.equal(s.promotions.length, 0);
  assert.equal(s.runs.at(-1).ok, false);
});
