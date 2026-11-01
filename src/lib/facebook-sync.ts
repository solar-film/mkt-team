import { prisma } from './prisma';
import { bangkokDateKey } from './bangkok-date';
import { fetchWindsorConnector, safeWindsorMessage } from './windsor';
import { D7_SNAPSHOT, FACEBOOK_POST_FIELDS, d7Due, matchPosts, normalizeFacebookPosts, postAgeDays } from './facebook-posts';

export const FACEBOOK_SYNC_PLATFORM = 'facebook_organic';
// Long enough that a post seen on day 7 is still re-read on day 9 if a night's run fails.
export const FACEBOOK_LOOKBACK_DAYS = 12;

export interface FacebookSyncResult { ok: boolean; posts: number; matched: number; d7: number; message: string | null }

const isoDay = (value: string) => new Date(`${value}T00:00:00.000Z`);

/**
 * Pulls page posts for from..to, stores them, matches unmatched posts to Facebook content items
 * near their publish day, and records D+7 reach for matched posts that are 7–9 days old.
 * A D+7 already in the system (typed in by a member, or recorded on an earlier night) is kept.
 */
export async function syncFacebookPosts(from: string, to: string, trigger: 'cron' | 'admin', now = new Date()): Promise<FacebookSyncResult> {
  const run = await prisma.adSyncRun.create({ data: { platform: FACEBOOK_SYNC_PLATFORM, trigger, dateFrom: isoDay(from), dateTo: isoDay(to) } });
  try {
    const posts = normalizeFacebookPosts(await fetchWindsorConnector(FACEBOOK_SYNC_PLATFORM, from, to, [...FACEBOOK_POST_FIELDS]));
    const existing = new Map((await prisma.facebookPost.findMany({
      where: { id: { in: posts.map(p => p.id) } }, select: { id: true, contentId: true, matchedBy: true },
    })).map(p => [p.id, p]));

    // Content items a day either side of the pulled posts are the only candidates.
    const days = posts.map(p => p.createdTime.getTime());
    const contents = days.length ? await prisma.content.findMany({
      where: {
        platform: 'Facebook',
        publishDate: { gte: new Date(Math.min(...days) - 2 * 86_400_000), lte: new Date(Math.max(...days) + 2 * 86_400_000) },
      },
      select: { id: true, title: true, publishDate: true },
    }) : [];
    const taken = new Set((await prisma.facebookPost.findMany({
      where: { contentId: { in: contents.map(c => c.id) } }, select: { contentId: true },
    })).map(p => p.contentId!));
    const unmatched = posts.filter(p => !existing.get(p.id)?.contentId);
    const matches = matchPosts(unmatched, contents, taken);

    await prisma.$transaction(posts.map(post => {
      const contentId = existing.get(post.id)?.contentId ?? matches.get(post.id) ?? null;
      const matchedBy = existing.get(post.id)?.matchedBy ?? (matches.has(post.id) ? 'auto' : null);
      const data = { pageId: post.pageId, createdTime: post.createdTime, message: post.message, reach: post.reach, reactions: post.reactions, comments: post.comments, contentId, matchedBy, fetchedAt: now };
      return prisma.facebookPost.upsert({ where: { id: post.id }, create: { id: post.id, ...data }, update: data });
    }));

    const due = posts
      .map(post => ({ post, contentId: existing.get(post.id)?.contentId ?? matches.get(post.id) }))
      .filter((p): p is { post: typeof p.post; contentId: string } => Boolean(p.contentId) && d7Due(p.post.createdTime, now) && p.post.reach !== null);
    const recorded = due.length ? await prisma.contentMetric.createMany({
      data: due.map(({ post, contentId }) => ({
        contentId, snapshot: D7_SNAPSHOT, recordedAt: now, reach: post.reach, likes: post.reactions, comments: post.comments,
        source: 'windsor', note: `ดึงอัตโนมัติจากเพจ Facebook (Windsor) ตอนโพสต์อายุ ${postAgeDays(post.createdTime, now)} วัน`,
      })),
      skipDuplicates: true,
    }) : { count: 0 };

    const result = { ok: true, posts: posts.length, matched: matches.size, d7: recorded.count, message: null };
    await prisma.adSyncRun.update({
      where: { id: run.id },
      data: { ok: true, rows: posts.length, message: `จับคู่ใหม่ ${matches.size} · บันทึก D+7 ${recorded.count}`, finishedAt: new Date() },
    });
    return result;
  } catch (error) {
    const message = safeWindsorMessage(error);
    console.error('Facebook post sync failed:', message);
    await prisma.adSyncRun.update({ where: { id: run.id }, data: { ok: false, message, finishedAt: new Date() } }).catch(() => {});
    return { ok: false, posts: 0, matched: 0, d7: 0, message };
  }
}

/** The nightly window: the last FACEBOOK_LOOKBACK_DAYS Thai days up to today. */
export function facebookWindow(now = new Date()) {
  const to = bangkokDateKey(now);
  const start = new Date(`${to}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (FACEBOOK_LOOKBACK_DAYS - 1));
  return { from: start.toISOString().slice(0, 10), to };
}
