import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSocialReach, socialPostId, SOCIAL_REACH_MIN_AGE_MS } from '../src/lib/social-reach';
import * as socialReach from '../src/lib/social-reach';
import * as facebookPosts from '../src/lib/facebook-posts';
import { bangkokDateKey } from '../src/lib/bangkok-date';
import { jsonRequest, loadSource } from './route-harness';

const now = new Date('2026-11-03T15:00:00Z');
const ig = (id: string, reach: unknown, time = '2026-10-20T08:00:00+0000') => ({ media_permalink: `https://www.instagram.com/reel/${id}/?utm_source=test`, media_shortcode: id, media_reach: reach, timestamp: time });
const tt = (id: string, reach: unknown, time = '2026-10-20T08:00:00') => ({ video_share_url: `https://www.tiktok.com/@mhlcarfilm/video/${id}?utm_source=test`, video_id: id, video_reach: reach, video_create_datetime: time });

test('full platform links prove exact identity, with tracking ignored; look-alike hosts and short links do not', () => {
  assert.equal(socialPostId('instagram', 'https://www.instagram.com/p/Devm3Djim5Y/?utm_source=x'), 'Devm3Djim5Y');
  assert.equal(socialPostId('instagram', 'instagram.com/reels/Devm3Djim5Y/'), 'Devm3Djim5Y');
  for (const link of ['https://instagram.com.attacker.test/p/Devm3Djim5Y/', 'https://instagram.com@attacker.test/p/Devm3Djim5Y/', 'https://attacker.test/instagram.com/p/Devm3Djim5Y/', 'https://www.instagram.com/p/Devm3Djim5Y/extra', 'https://www.instagram.com:444/p/Devm3Djim5Y/']) assert.equal(socialPostId('instagram', link), null);
  assert.equal(socialPostId('tiktok_organic', 'https://www.tiktok.com/@a/video/7699794867555241234'), '7699794867555241234');
  assert.equal(socialPostId('tiktok_organic', 'https://vt.tiktok.com/ZSabc/'), null);
  assert.equal(socialPostId('tiktok_organic', 'https://facebook.com/reel/7699794867555241234'), null);
});

test('source normalization keeps real zero, rejects absent/unsafe reach, and uses actual zoned post time', () => {
  const { posts } = normalizeSocialReach('instagram', [ig('ShortA12345', 0), ig('ShortB12345', null), ig('ShortC12345', ''), ig('ShortD12345', -1), ig('ShortE12345', 1.5), ig('ShortF12345', Infinity), ig('ShortG12345', 2_147_483_648), ig('ShortH12345', 2_147_483_647)]);
  assert.deepEqual(posts.map(p => p.reach), [0, null, null, null, null, null, null, 2_147_483_647]);
  assert.equal(posts[0].postedAt.toISOString(), '2026-10-20T08:00:00.000Z');
  assert.equal(posts[0].url, 'https://www.instagram.com/reel/ShortA12345/');
  assert.equal(normalizeSocialReach('instagram', [ig('ShortA12345', 3, '2026-10-20T08:00:00')]).posts.length, 0, 'unqualified Instagram time cannot establish age');
  assert.equal(normalizeSocialReach('tiktok_organic', [tt('7699794867555241234', 12)]).posts[0].postedAt.toISOString(), '2026-10-20T08:00:00.000Z');
});

test('identical duplicates are deduplicated; conflicting reach, post time, or declared ID never gets selected', () => {
  assert.equal(normalizeSocialReach('instagram', [ig('ShortA12345', 9), ig('ShortA12345', 9)]).posts.length, 1);
  const conflict = normalizeSocialReach('instagram', [ig('ShortA12345', 9), ig('ShortA12345', 10), ig('ShortA12345', 9)]);
  assert.equal(conflict.posts.length, 0);
  assert.equal(conflict.ambiguous, 1);
  assert.equal(normalizeSocialReach('instagram', [ig('ShortA12345', 9), ig('ShortA12345', 9, '2026-10-21T08:00:00Z')]).ambiguous, 1);
  assert.equal(normalizeSocialReach('instagram', [{ ...ig('ShortA12345', 9), media_shortcode: 'Different123' }]).ambiguous, 1);
  assert.throws(() => normalizeSocialReach('instagram', { error: 'not a list' }));
});

type Metric = { id: string; contentId: string; reach: number | null; note: string | null; source: string; likes?: number };
type Content = { id: string; link: string; platform?: string; submittedAt?: string; promotion?: string | null };

function service(rows: unknown, contents: Content[], initial: Metric[] = [], beforeSave?: (metrics: Map<string, Metric>) => void) {
  const metrics = new Map(initial.map(metric => [metric.contentId, { ...metric }]));
  const savedContents = new Map(contents.map(content => [content.id, { ...content }]));
  const contentWrites: unknown[] = [];
  let pulls = 0;
  let transactionCount = 0;
  const db = {
    content: {
      findMany: async ({ where }: any) => contents.filter(c => (c.platform ?? 'Instagram').toLowerCase() === where.platform.equals.toLowerCase()).map(c => ({ ...c, metrics: metrics.has(c.id) ? [{ ...metrics.get(c.id)! }] : [] })),
      updateMany: async (args: any) => {
        assert.deepEqual(Object.keys(args.data), ['promotion']);
        assert.equal(args.data.promotion, 'organic');
        contentWrites.push(args);
        for (const id of args.where.id.in) savedContents.get(id)!.promotion = args.data.promotion;
        return { count: args.where.id.in.length };
      },
    },
    contentMetric: {
      createMany: async ({ data }: any) => {
        const value = data[0];
        if (metrics.has(value.contentId)) return { count: 0 };
        metrics.set(value.contentId, { id: `metric-${value.contentId}`, ...value }); return { count: 1 };
      },
      updateMany: async ({ where, data }: any) => {
        const previous = [...metrics.values()].find(metric => metric.id === where.id);
        if (!previous || previous.reach !== null || previous.note !== where.note || previous.source !== where.source) return { count: 0 };
        metrics.set(previous.contentId, { ...previous, ...data }); return { count: 1 };
      },
    },
    $transaction: async (save: (tx: any) => Promise<unknown>) => { transactionCount++; beforeSave?.(metrics); return save(db); },
  };
  const organicReach = loadSource('src/lib/organic-reach.ts', { './prisma': { prisma: db } });
  const module = loadSource('src/lib/social-reach-backfill.ts', {
    './prisma': { prisma: db }, './organic-reach': organicReach, './bangkok-date': { bangkokDateKey }, './facebook-posts': facebookPosts, './social-reach': socialReach,
    './windsor': { fetchWindsorConnector: async (_platform: string, _from: string, _to: string, fields: string[], timeout: number) => {
      pulls++; assert.ok(fields.includes('media_reach') || fields.includes('video_reach')); assert.equal(timeout, 40_000);
      return rows;
    }, safeWindsorMessage: () => 'source failed' },
  });
  return { metrics, contents: savedContents, contentWrites, pulls: () => pulls, transactions: () => transactionCount,
    run: (platform = 'instagram', at = now) => module.backfillSocialReach(platform, '2026-10-15', '2026-10-21', at) };
}

test('fills exact linked blanks including source zero, sets saved items Organic even if Paid, and keeps other metadata/numbers', async () => {
  const contents = [
    { id: 'new', link: 'https://instagram.com/p/ShortA12345/', promotion: 'paid', submittedAt: '2026-10-20T08:00:00Z' },
    { id: 'duplicate-link', link: 'https://instagram.com/reel/ShortA12345/' },
    { id: 'empty', link: 'https://instagram.com/p/ShortB12345/', promotion: 'paid' },
    { id: 'zero', link: 'https://instagram.com/p/ShortC12345/', promotion: 'paid' },
    { id: 'typed', link: 'https://instagram.com/p/ShortD12345/' },
    { id: 'wrong-platform', platform: 'YouTube', link: 'https://instagram.com/p/ShortA12345/' },
    { id: 'same-title-but-no-id', link: 'https://instagram.com/p/OtherA12345/' },
  ];
  const initial = [
    { id: 'm-empty', contentId: 'empty', reach: null, note: 'ข้อความเดิม', source: 'manual', likes: 99 },
    { id: 'm-zero', contentId: 'zero', reach: 0, note: 'ศูนย์จริง', source: 'manual' },
    { id: 'm-typed', contentId: 'typed', reach: 4, note: 'ทีมกรอก', source: 'manual' },
  ];
  const s = service([ig('ShortA12345', 0), ig('ShortB12345', 10), ig('ShortC12345', 88), ig('ShortD12345', 12), ig('Unused12345', 5)], contents, initial);
  const result = await s.run();
  assert.equal(result.ok, true);
  assert.deepEqual([result.created, result.filled, result.kept, result.matched, result.unmatched], [2, 1, 2, 5, 1]);
  assert.equal(s.metrics.get('new')?.reach, 0);
  assert.equal(s.metrics.get('new')?.source, 'api');
  assert.match(s.metrics.get('new')!.note!, /ยอดสะสม ณ 2026-11-03 ไม่ใช่ยอดวันที่ 7 พอดี/);
  assert.match(s.metrics.get('empty')!.note!, /^ข้อความเดิม · Reach จาก Instagram/);
  assert.match(s.metrics.get('empty')!.note!, /https:\/\/www\.instagram\.com\/reel\/ShortB12345\//);
  assert.equal(s.metrics.get('empty')?.likes, 99);
  assert.deepEqual(s.metrics.get('zero'), initial[1]);
  assert.deepEqual(s.metrics.get('typed'), initial[2]);
  assert.equal(s.metrics.has('wrong-platform'), false);
  assert.equal(s.contentWrites.length, 1);
  assert.equal(s.contents.get('new')?.promotion, 'organic');
  assert.equal(s.contents.get('empty')?.promotion, 'organic');
  assert.equal(s.contents.get('zero')?.promotion, 'paid');
  for (const content of contents) {
    const saved = s.contents.get(content.id)!;
    const { promotion: _promotion, ...metadata } = saved;
    const { promotion: _before, ...originalMetadata } = content;
    assert.deepEqual(metadata, originalMetadata);
  }
});

test('uses a full 168 hours from actual post time, and missing source reach is left blank', async () => {
  const at = now.getTime();
  const s = service([
    ig('ExactA12345', 3, new Date(at - SOCIAL_REACH_MIN_AGE_MS).toISOString()),
    ig('YoungA12345', 4, new Date(at - SOCIAL_REACH_MIN_AGE_MS + 1).toISOString()),
    ig('NoReach1234', null),
  ], [
    { id: 'exact', link: 'https://instagram.com/p/ExactA12345/' },
    { id: 'young', link: 'https://instagram.com/p/YoungA12345/' },
    { id: 'missing', link: 'https://instagram.com/p/NoReach1234/' },
  ]);
  const result = await s.run();
  assert.deepEqual([result.created, result.young, result.missingReach], [1, 1, 1]);
  assert.equal(s.metrics.has('young'), false);
  assert.equal(s.metrics.has('missing'), false);
  assert.equal(s.contents.get('exact')?.promotion, 'organic');
  assert.equal(s.contents.get('young')?.promotion, undefined);
  assert.equal(s.contents.get('missing')?.promotion, undefined);
});

test('a concurrent manual create, reach edit, or note edit wins over historical loading', async () => {
  const s = service([ig('ShortA12345', 9), ig('ShortB12345', 9), ig('ShortC12345', 9)], [
    { id: 'new', link: 'https://instagram.com/p/ShortA12345/' }, { id: 'empty', link: 'https://instagram.com/p/ShortB12345/' }, { id: 'note', link: 'https://instagram.com/p/ShortC12345/' },
  ], [
    { id: 'm-empty', contentId: 'empty', reach: null, note: null, source: 'manual' },
    { id: 'm-note', contentId: 'note', reach: null, note: null, source: 'manual' },
  ], metrics => {
    metrics.set('new', { id: 'new-by-member', contentId: 'new', reach: 0, source: 'manual', note: 'fresh' });
    metrics.get('empty')!.reach = 100;
    metrics.get('note')!.note = 'member changed note';
  });
  const result = await s.run();
  assert.deepEqual([result.created, result.filled, result.kept], [0, 0, 3]);
  assert.equal(s.metrics.get('new')?.reach, 0);
  assert.equal(s.metrics.get('empty')?.reach, 100);
  assert.equal(s.metrics.get('note')?.reach, null);
  assert.equal(s.metrics.get('note')?.note, 'member changed note');
  assert.equal(s.contentWrites.length, 0, 'concurrent/duplicate no-ops must not set Organic');
});

test('TikTok identity is exact, an old video can backfill, and failed/ambiguous source data writes nothing', async () => {
  const ttService = service([tt('7699794867555241234', 153)], [{ id: 'tt', platform: 'TikTok', link: 'https://www.tiktok.com/@mhlcarfilm/video/7699794867555241234' }]);
  assert.equal((await ttService.run('tiktok_organic')).created, 1);
  assert.match(ttService.metrics.get('tt')!.note!, /TikTok/);
  assert.equal(ttService.contents.get('tt')?.promotion, 'organic');
  const failed = service(null, [{ id: 'c', link: 'https://instagram.com/p/ShortA12345/' }]);
  assert.equal((await failed.run()).ok, false);
  assert.equal(failed.transactions(), 0);
  const conflict = service([ig('ShortA12345', 1), ig('ShortA12345', 2)], [{ id: 'c', link: 'https://instagram.com/p/ShortA12345/' }]);
  assert.equal((await conflict.run()).ambiguous, 1);
  assert.equal(conflict.transactions(), 0);
});

function route(options: { authenticated?: boolean; configured?: boolean; writes?: number; ok?: boolean } = {}) {
  const calls: unknown[][] = [];
  let invalidations = 0;
  const module = loadSource('src/app/api/admin/social-reach/route.ts', {
    '@/lib/admin-session': { hasAdminSession: () => options.authenticated !== false },
    '@/lib/windsor': { windsorConfigured: () => options.configured !== false },
    '@/lib/social-reach-backfill': { backfillSocialReach: async (...args: unknown[]) => { calls.push(args); return { ok: options.ok !== false, created: options.writes ?? 0, filled: 0 }; } },
    '@/lib/workspace-cache': { invalidateWorkspace: () => { invalidations++; } },
  });
  return { calls, invalidations: () => invalidations, post: (body: unknown) => module.POST(jsonRequest('/api/admin/social-reach', 'POST', body)) };
}

test('route refuses unauthenticated/unconfigured/invalid requests before pulling anything', async () => {
  const unauthorized = route({ authenticated: false });
  assert.equal((await unauthorized.post({ platform: 'instagram', month: '2026-10' })).status, 401);
  assert.equal(unauthorized.calls.length, 0);
  assert.equal((await route({ configured: false }).post({ platform: 'instagram', month: '2026-10' })).status, 503);
  const r = route();
  for (const body of [null, [], { platform: 'youtube', month: '2026-10' }, { platform: 'instagram', month: '2026-13' }, { platform: 'instagram', month: '2026-10', part: '0' }, { platform: 'instagram', month: '2026-10', part: 5 }]) assert.equal((await r.post(body)).status, 400);
  assert.equal(r.calls.length, 0);
});

test('route returns a bounded weekly part, invalidates only saved data, and reports source failure', async () => {
  const r = route({ writes: 2 });
  const response = await r.post({ platform: 'instagram', month: '2026-10', part: 2 });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual([body.from, body.to, body.part, body.parts], ['2026-10-15', '2026-10-21', 2, 5]);
  assert.equal(r.invalidations(), 1);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const noWrites = route();
  await noWrites.post({ platform: 'tiktok_organic', month: '2026-10', part: 4 });
  assert.equal(noWrites.invalidations(), 0);
  assert.equal((await route({ ok: false }).post({ platform: 'instagram', month: '2026-10' })).status, 502);
});
