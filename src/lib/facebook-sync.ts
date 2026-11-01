import { prisma } from './prisma';
import { bangkokDateKey } from './bangkok-date';
import { fetchWindsorConnector, safeWindsorMessage } from './windsor';
import { D7_MIN_DAYS, D7_SNAPSHOT, FACEBOOK_POST_FIELDS, PAGE_METRIC_SOURCE, backfillAction, d7Due, isVideoShareLink, matchByVideo, matchPosts, normalizeFacebookPosts, postAgeDays, videoIdFromUrl } from './facebook-posts';

export const FACEBOOK_SYNC_PLATFORM = 'facebook_organic';
// Long enough that a post seen on day 7 is still re-read on day 9 if a night's run fails.
export const FACEBOOK_LOOKBACK_DAYS = 12;
// Leaves time for saving and matching inside the 60-second request, so a slow Windsor reply is
// reported as an error instead of the request being cut off.
const WINDSOR_WAIT_MS = 40_000;
const SHARE_LINK_WAIT_MS = 5_000;

/** A content link's reel number: read from the link itself, or from where a share/r|v link redirects. */
async function contentVideoId(link: string | null): Promise<string | null> {
  const direct = videoIdFromUrl(link);
  if (direct || !link || !isVideoShareLink(link)) return direct;
  try {
    const response = await fetch(link, { redirect: 'manual', cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(SHARE_LINK_WAIT_MS) });
    return videoIdFromUrl(response.headers.get('location'));
  } catch {
    return null; // the post can still be matched by its text
  }
}

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
    const posts = normalizeFacebookPosts(await fetchWindsorConnector(FACEBOOK_SYNC_PLATFORM, from, to, [...FACEBOOK_POST_FIELDS], WINDSOR_WAIT_MS));
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
      select: { id: true, title: true, publishDate: true, link: true },
    }) : [];
    const taken = new Set((await prisma.facebookPost.findMany({
      where: { contentId: { in: contents.map(c => c.id) } }, select: { contentId: true },
    })).map(p => p.contentId!));
    const unmatched = posts.filter(p => !existing.get(p.id)?.contentId);
    // Reels and videos are paired exactly by the number in the content's link; the rest by text and day.
    const videos = new Map<string, string>();
    await Promise.all(contents.filter(c => !taken.has(c.id)).map(async c => {
      const videoId = await contentVideoId(c.link);
      if (videoId) videos.set(c.id, videoId);
    }));
    const byLink = matchByVideo(unmatched, videos, taken);
    const byText = matchPosts(unmatched.filter(p => !byLink.has(p.id)), contents, new Set([...taken, ...byLink.values()]));
    const matches = new Map([...byLink, ...byText]);

    await prisma.$transaction(posts.map(post => {
      const contentId = existing.get(post.id)?.contentId ?? matches.get(post.id) ?? null;
      const matchedBy = existing.get(post.id)?.matchedBy ?? (byLink.has(post.id) ? 'link' : matches.has(post.id) ? 'auto' : null);
      const data = { pageId: post.pageId, createdTime: post.createdTime, message: post.message, reach: post.reach, reactions: post.reactions, comments: post.comments, contentId, matchedBy, fetchedAt: now };
      return prisma.facebookPost.upsert({ where: { id: post.id }, create: { id: post.id, ...data }, update: data });
    }));

    const due = posts
      .map(post => ({ post, contentId: existing.get(post.id)?.contentId ?? matches.get(post.id) }))
      .filter((p): p is { post: typeof p.post; contentId: string } => Boolean(p.contentId) && d7Due(p.post.createdTime, now) && p.post.reach !== null);
    const recorded = due.length ? await prisma.contentMetric.createMany({
      data: due.map(({ post, contentId }) => ({
        contentId, snapshot: D7_SNAPSHOT, recordedAt: now, reach: post.reach, likes: post.reactions, comments: post.comments,
        source: PAGE_METRIC_SOURCE, note: `ดึงอัตโนมัติจากเพจ Facebook (Windsor) ตอนโพสต์อายุ ${postAgeDays(post.createdTime, now)} วัน`,
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

export interface FacebookBackfillResult extends FacebookSyncResult { created: number; filled: number; kept: number; young: number }

/**
 * Fills D+7 reach for a past window from Windsor (admin button): pulls and matches posts like the
 * nightly run, then for every matched post at least 7 days old applies backfillAction — create a
 * D+7, fill an empty/0 reach, or keep a typed one. Each written row says it is the running total.
 */
export async function backfillFacebookReach(from: string, to: string, now = new Date()): Promise<FacebookBackfillResult> {
  const sync = await syncFacebookPosts(from, to, 'admin', now);
  const empty = { ...sync, created: 0, filled: 0, kept: 0, young: 0 };
  if (!sync.ok) return empty;

  const posts = await prisma.facebookPost.findMany({
    where: { createdTime: { gte: new Date(`${from}T00:00:00+07:00`), lte: new Date(`${to}T23:59:59+07:00`) }, contentId: { not: null }, reach: { not: null } },
  });
  const ready = posts.filter(post => postAgeDays(post.createdTime, now) >= D7_MIN_DAYS);
  const metrics = new Map((await prisma.contentMetric.findMany({
    where: { contentId: { in: ready.map(p => p.contentId!) }, snapshot: D7_SNAPSHOT },
    select: { id: true, contentId: true, reach: true, likes: true, comments: true, note: true },
  })).map(m => [m.contentId, m]));

  const dayLabel = bangkokDateKey(now);
  const note = (age: number) => `Reach จาก Windsor ย้อนหลัง: ยอดสะสม ณ ${dayLabel} (โพสต์อายุ ${age} วัน) ไม่ใช่ยอดวันที่ 7 พอดี`;
  const writes = [];
  const counts = { created: 0, filled: 0, kept: 0 };
  for (const post of ready) {
    const existing = metrics.get(post.contentId!) ?? null;
    const action = backfillAction(existing);
    const age = postAgeDays(post.createdTime, now);
    if (action === 'create') {
      counts.created++;
      writes.push(prisma.contentMetric.create({
        data: { contentId: post.contentId!, snapshot: D7_SNAPSHOT, recordedAt: now, reach: post.reach, likes: post.reactions, comments: post.comments, source: PAGE_METRIC_SOURCE, note: note(age) },
      }));
    } else if (action === 'fill' && existing) {
      counts.filled++;
      // Only the empty numbers are filled; likes/comments a member typed stay.
      writes.push(prisma.contentMetric.update({
        where: { id: existing.id },
        data: {
          reach: post.reach,
          likes: existing.likes ?? post.reactions,
          comments: existing.comments ?? post.comments,
          note: existing.note ? `${existing.note} · ${note(age)}` : note(age),
        },
      }));
    } else counts.kept++;
  }
  if (writes.length) await prisma.$transaction(writes);
  return { ...sync, ...counts, young: posts.length - ready.length };
}

/** The nightly window: the last FACEBOOK_LOOKBACK_DAYS Thai days up to today. */
export function facebookWindow(now = new Date()) {
  const to = bangkokDateKey(now);
  const start = new Date(`${to}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (FACEBOOK_LOOKBACK_DAYS - 1));
  return { from: start.toISOString().slice(0, 10), to };
}
