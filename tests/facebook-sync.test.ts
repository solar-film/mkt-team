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
function service(rows: ReturnType<typeof row>[] | null, initialMetrics: Metric[] = [], beforeReachSave?: (metrics: Map<string, Metric>) => void) {
  const contents = new Map((rows ?? []).map(r => {
    const id = r.post_id.slice('page_'.length);
    return [id, { id, title: r.post_message, publishDate: new Date(r.post_created_time),
      link: `https://www.facebook.com/page/posts/${id}`, promotion: 'paid', submittedAt: null as string | null }];
  }));
  const posts = new Map((rows ?? []).map(r => [r.post_id, {
    id: r.post_id, contentId: r.post_id.slice('page_'.length) as string | null, matchedBy: 'link' as string | null,
    createdTime: new Date(r.post_created_time), reach: r.post_total_media_view_unique,
  }]));
  const metrics = new Map(initialMetrics.map(m => [m.contentId, { ...m }]));
  const promotions: { ids: string[]; data: Record<string, unknown> }[] = [];
  const runs: any[] = [];
  const queries = { bulkCreates: 0, singleCreates: 0, fills: 0 };
  let inReachTransaction = false;
  let beforeSaveCalled = false;
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
        queries.bulkCreates++;
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
      findMany: async () => [...metrics.values()].map(m => ({ ...m })),
      create: ({ data }: any) => lazy(() => {
        queries.singleCreates++;
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
      updateMany: ({ where, data }: any) => lazy(() => {
        queries.fills++;
        const previous = [...metrics.values()].find(m => Object.entries(where).every(([key, value]) =>
          value === undefined || (m as any)[key] === value,
        ));
        if (!previous) return { count: 0 };
        metrics.set(previous.contentId, { ...previous, ...data });
        return { count: 1 };
      }),
    },
    $transaction: async (writes: any) => {
      if (typeof writes !== 'function') return Promise.all(writes);
      if (!beforeSaveCalled) { beforeSaveCalled = true; beforeReachSave?.(metrics); }
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
  return { contents, posts, metrics, promotions, runs, queries,
    sync: () => module.syncFacebookPosts('2026-10-01', '2026-11-03', 'cron', now),
    backfill: (from = '2026-10-01', to = '2026-11-03') => module.backfillFacebookReach(from, to, now),
  };
}

test('an exact photo parent-post link pairs despite a generic title, then saves historical Reach and Organic', async () => {
  const sourceId = '101634951180913_1417619013721591';
  const s = service([{ ...row('1417619013721591', '2026-07-01', 79), post_id: sourceId }]);
  const content = [...s.contents.values()][0];
  content.title = 'ผลงานติดฟิล์มอาคาร';
  content.link = 'https://www.facebook.com/photo/?fbid=1417619707054855&set=pcb.1417619013721591';
  s.posts.get(sourceId)!.contentId = null;
  s.posts.get(sourceId)!.matchedBy = null;
  const result = await s.backfill('2026-07-01', '2026-07-07');
  assert.equal(result.ok, true);
  assert.equal(result.matched, 1);
  assert.equal(result.created, 1);
  assert.equal(s.posts.get(sourceId)?.matchedBy, 'link');
  assert.equal(s.posts.get(sourceId)?.contentId, content.id);
  assert.equal(s.metrics.get(content.id)?.reach, 79);
  assert.match(s.metrics.get(content.id)?.note ?? '', /ยอดสะสม ณ/);
  assert.equal(s.contents.get(content.id)?.promotion, 'organic');
});

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

test('Facebook historical windows with 46 new D+7 rows use one bulk create instead of one insert per row', async () => {
  const s = service(Array.from({ length: 46 }, (_, i) => row(`bulk-${i}`, '2026-10-10', 100 + i)));
  const result = await s.backfill();
  assert.equal(result.ok, true);
  assert.deepEqual([result.created, result.filled, result.kept], [46, 0, 0]);
  assert.equal(s.queries.bulkCreates, 1, 'one SQL create statement for a seven-day window');
  assert.equal(s.queries.singleCreates, 0, 'avoid 46 serial inserts inside the timed transaction');
  assert.equal(s.metrics.size, 46);
  assert.equal(s.promotions.flatMap(p => p.ids).length, 46);
  assert.equal([...s.contents.values()].every(c => c.promotion === 'organic'), true);
});

test('Facebook historical duplicate creates and concurrent edits skipped by CAS keep both member Reach and Paid', async () => {
  const s = service([
    row('raced-create', '2026-10-10', 20), row('raced-fill', '2026-10-11', 30), row('saved-fill', '2026-10-12', 40),
  ], [
    { id: 'raced-metric', contentId: 'raced-fill', reach: null, likes: 1, comments: 2, note: null },
    { id: 'saved-metric', contentId: 'saved-fill', reach: null, likes: 3, comments: 4, note: null },
  ], metrics => {
    metrics.set('raced-create', { id: 'member-created', contentId: 'raced-create', reach: 0, note: 'member inserted' });
    metrics.get('raced-fill')!.reach = 99;
  });
  const result = await s.backfill();
  assert.equal(result.ok, true);
  assert.deepEqual([result.created, result.filled, result.kept], [0, 1, 2]);
  assert.equal(s.metrics.get('raced-create')?.reach, 0);
  assert.equal(s.metrics.get('raced-fill')?.reach, 99);
  assert.equal(s.contents.get('raced-create')?.promotion, 'paid');
  assert.equal(s.contents.get('raced-fill')?.promotion, 'paid');
  assert.equal(s.contents.get('saved-fill')?.promotion, 'organic');
  assert.deepEqual(s.promotions.flatMap(p => p.ids), ['saved-fill']);
});
