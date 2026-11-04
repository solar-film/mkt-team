import assert from 'node:assert/strict';
import test from 'node:test';
import { isTikTokShortLink, normalizeTikTokVideos, parseTikTokTime, tiktokVideoIdFromUrl } from '../src/lib/tiktok-posts';
import * as facebookPosts from '../src/lib/facebook-posts';
import * as tiktokPosts from '../src/lib/tiktok-posts';
import { loadSource } from './route-harness';

test('Windsor post time has no zone and is read as UTC', () => {
  assert.equal(parseTikTokTime('2026-10-23T11:00:00')!.toISOString(), '2026-10-23T11:00:00.000Z');
  assert.equal(parseTikTokTime('2026-10-23T11:00:00+07:00')!.toISOString(), '2026-10-23T04:00:00.000Z');
  assert.equal(parseTikTokTime(''), null);
  assert.equal(parseTikTokTime('not a time'), null);
});

test('Windsor rows become videos; rows without id or time are dropped, duplicates merged', () => {
  const videos = normalizeTikTokVideos([
    { video_id: '7699794867555241234', video_create_datetime: '2026-10-23T11:00:00', video_caption: 'ทำไมหลายคนถึงเลือก ติดฟิล์ม 2 ชั้น', video_reach: 152, video_views_count: 165, video_likes: null },
    { video_id: '', video_create_datetime: '2026-10-23T11:00:00' },
    { video_id: '7699794867555241235', video_create_datetime: null },
    { video_id: '7699794867555241234', video_create_datetime: '2026-10-23T11:00:00', video_caption: 'ซ้ำ', video_reach: 160 },
  ]);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].reach, 160);
  assert.equal(videos[0].message, 'ซ้ำ');
  assert.equal(videos[0].likes, null);
  assert.throws(() => normalizeTikTokVideos({ error: 'x' }));
});

test('video number is read from full links only; short links are recognised for a redirect', () => {
  assert.equal(tiktokVideoIdFromUrl('https://www.tiktok.com/@mhlcarfilm/video/7699794867555241234?utm_source=x'), '7699794867555241234');
  assert.equal(tiktokVideoIdFromUrl('tiktok.com/@maholan.film/photo/7701541405469969670'), '7701541405469969670');
  assert.equal(tiktokVideoIdFromUrl('https://vt.tiktok.com/ZSabc123/'), null);
  assert.equal(tiktokVideoIdFromUrl('https://www.facebook.com/reel/7699794867555241234'), null);
  assert.equal(isTikTokShortLink('https://vt.tiktok.com/ZSabc123/'), true);
  assert.equal(isTikTokShortLink('vm.tiktok.com/ZSabc123/'), true);
  assert.equal(isTikTokShortLink('https://www.tiktok.com/t/ZTabc/'), true);
  assert.equal(isTikTokShortLink('https://www.tiktok.com/@a/video/7699794867555241234'), false);
});

/** tiktok-sync with an in-memory database and a fixed Windsor answer. */
function syncWith(rows: unknown[], contents: any[], existingMetrics: string[] = []) {
  const updates: { id: string; data: any }[] = [];
  const promotionUpdates: any[] = [];
  const metrics: any[] = [];
  const runs: any[] = [];
  const prisma: any = {
    adSyncRun: { create: async () => ({ id: 'run1' }), update: async ({ data }: any) => runs.push(data) },
    content: {
      findMany: async () => contents,
      // Dates made inside the loaded module come from another realm, so they are kept as ISO text.
      update: (args: any) => { updates.push({ id: args.where.id, data: { ...args.data, submittedAt: args.data.submittedAt.toISOString() } }); return args; },
      updateMany: async (args: any) => { promotionUpdates.push(args); return { count: args.where.id.in.length }; },
    },
    contentMetric: {
      createManyAndReturn: async ({ data, select, skipDuplicates }: any) => {
        assert.equal(skipDuplicates, true);
        assert.deepEqual(Object.keys(select), ['contentId']);
        const fresh = data.filter((m: any) => !existingMetrics.includes(m.contentId));
        metrics.push(...fresh);
        return fresh.map((m: any) => ({ contentId: m.contentId }));
      },
    },
    $transaction: async (writes: any) => typeof writes === 'function' ? writes(prisma) : writes,
  };
  const organicReach = loadSource('src/lib/organic-reach.ts', { './prisma': { prisma } });
  const sync = loadSource('src/lib/tiktok-sync.ts', {
    './prisma': { prisma },
    './organic-reach': organicReach,
    './windsor': { fetchWindsorConnector: async () => rows, safeWindsorMessage: (e: unknown) => String(e) },
    './facebook-posts': facebookPosts,
    './tiktok-posts': tiktokPosts,
  }, { AbortSignal, fetch: async () => { throw new Error('no network in tests'); } });
  return { run: (now: Date) => sync.syncTikTokVideos('2026-10-20', '2026-11-01', 'cron', now), updates, promotionUpdates, metrics, runs };
}

const row = (id: string, at: string, caption: string, reach: number | null) =>
  ({ video_id: id, video_create_datetime: at, video_caption: caption, video_reach: reach, video_views_count: 10, video_likes: 1, video_comments: 0, video_shares: 0 });

test('a video pairs by the number in the content link, sets the real post time, and records D+7 at day 7–9', async () => {
  const { run, updates, promotionUpdates, metrics } = syncWith(
    [row('7699794867555241234', '2026-10-23T11:00:00', 'แคปชันที่ไม่ตรงชื่อเลย', 152)],
    [{ id: 'c1', title: 'ฟิล์ม 2 ชั้น', publishDate: new Date('2026-10-23T05:00:00Z'), link: 'https://www.tiktok.com/@mhlcarfilm/video/7699794867555241234', platformPostId: null }],
  );
  const result = await run(new Date('2026-10-31T03:00:00Z')); // 8 Thai days after the post
  assert.equal(result.ok, true);
  assert.equal(result.matched, 1);
  assert.deepEqual(updates, [{ id: 'c1', data: { submittedAt: '2026-10-23T11:00:00.000Z', platformPostId: '7699794867555241234' } }]);
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].reach, 152);
  assert.equal(metrics[0].source, 'api');
  assert.equal(metrics[0].snapshot, 'D+7');
  assert.equal(promotionUpdates.length, 1);
  assert.equal(promotionUpdates[0].where.id.in.join(','), 'c1');
  assert.equal(promotionUpdates[0].data.promotion, 'organic');
});

test('without a link number a video pairs by caption and day; too young or no reach yet records no D+7', async () => {
  const { run, updates, promotionUpdates, metrics } = syncWith(
    [
      row('7701650938255428885', '2026-10-29T01:00:00', 'ราคาดี มีคุณภาพ…คุณมีสิทธิ์เลือกครับ! 🪟 ✓ มีฟิล์มหลายแบรนด์', 136),
      row('7703511025944988936', '2026-11-02T09:57:24', 'สมัครงานวันแรก…ได้เป็น CEO เลย!?', null),
    ],
    [
      { id: 'c2', title: 'ราคาดี มีคุณภาพ คุณมีสิทธิ์เลือกครับ', publishDate: new Date('2026-10-29T02:00:00Z'), link: 'https://vt.tiktok.com/ZSabc/', platformPostId: null },
      { id: 'c3', title: 'สมัครงานวันแรก ได้เป็น CEO เลย', publishDate: new Date('2026-11-02T03:00:00Z'), link: null, platformPostId: null },
    ],
  );
  const result = await run(new Date('2026-11-02T12:00:00Z'));
  assert.equal(result.matched, 2);
  assert.deepEqual(updates.map(u => [u.id, u.data.platformPostId]), [['c2', '7701650938255428885'], ['c3', '7703511025944988936']]);
  assert.equal(metrics.length, 0, 'c2 is 4 days old, c3 has no reach yet');
  assert.equal(promotionUpdates.length, 0);
});

test('a pair made on an earlier night keeps updating the post time, and a typed D+7 is kept', async () => {
  const { run, updates, promotionUpdates, metrics } = syncWith(
    [row('7699794867555241234', '2026-10-23T11:00:00', 'อะไรก็ได้', 152)],
    [{ id: 'c1', title: 'ชื่อไม่ตรง', publishDate: new Date('2026-10-01T05:00:00Z'), link: null, platformPostId: '7699794867555241234' }],
    ['c1'],
  );
  const result = await run(new Date('2026-10-31T03:00:00Z'));
  assert.equal(result.matched, 0, 'not a new pair');
  assert.deepEqual(updates, [{ id: 'c1', data: { submittedAt: '2026-10-23T11:00:00.000Z' } }]);
  assert.equal(result.d7, 0);
  assert.equal(metrics.length, 0);
  assert.equal(promotionUpdates.length, 0, 'kept D+7 must not reclassify the content');
});

test('a Windsor failure is reported and recorded, not thrown', async () => {
  const { run, runs } = syncWith(null as unknown as unknown[], []);
  const result = await run(new Date('2026-10-31T03:00:00Z'));
  assert.equal(result.ok, false);
  assert.equal(runs[0].ok, false);
});
