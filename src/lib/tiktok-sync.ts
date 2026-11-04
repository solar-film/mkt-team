import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { fetchWindsorConnector, safeWindsorMessage } from './windsor';
import { D7_SNAPSHOT, PAGE_METRIC_SOURCE, d7Due, matchByVideo, matchPosts, postAgeDays } from './facebook-posts';
import { recordOrganicReach } from './organic-reach';
import {
  TIKTOK_CONTENT_PLATFORM, TIKTOK_SYNC_PLATFORM, TIKTOK_VIDEO_FIELDS, isTikTokShortLink, normalizeTikTokVideos, tiktokVideoIdFromUrl,
} from './tiktok-posts';

// Same budget as the Facebook run: leaves time for matching and saving inside the 60-second request.
const WINDSOR_WAIT_MS = 40_000;
const SHARE_LINK_WAIT_MS = 5_000;

export interface TikTokSyncResult { ok: boolean; videos: number; matched: number; d7: number; message: string | null }

const isoDay = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** A content link's video number: read from the link itself, or from where a short link redirects. */
async function contentVideoId(link: string | null): Promise<string | null> {
  const direct = tiktokVideoIdFromUrl(link);
  if (direct || !link || !isTikTokShortLink(link)) return direct;
  try {
    const url = link.startsWith('http') ? link : `https://${link}`;
    const response = await fetch(url, { redirect: 'manual', cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(SHARE_LINK_WAIT_MS) });
    return tiktokVideoIdFromUrl(response.headers.get('location'));
  } catch {
    return null; // the video can still be matched by its caption
  }
}

/**
 * Pulls TikTok videos posted from..to, pairs new ones with TikTok content items (the pair is kept
 * in Content.platformPostId), sets each paired item's hand-in time to the real post time, and
 * records D+7 reach for paired videos that are 7–9 days old. A D+7 already in the system is kept.
 */
export async function syncTikTokVideos(from: string, to: string, trigger: 'cron' | 'admin', now = new Date()): Promise<TikTokSyncResult> {
  const run = await prisma.adSyncRun.create({ data: { platform: TIKTOK_SYNC_PLATFORM, trigger, dateFrom: isoDay(from), dateTo: isoDay(to) } });
  try {
    const videos = normalizeTikTokVideos(await fetchWindsorConnector(TIKTOK_SYNC_PLATFORM, from, to, [...TIKTOK_VIDEO_FIELDS], WINDSOR_WAIT_MS));
    const times = videos.map(v => v.createdTime.getTime());
    const contents = videos.length ? await prisma.content.findMany({
      where: {
        OR: [
          { platformPostId: { in: videos.map(v => v.id) } },
          {
            platform: TIKTOK_CONTENT_PLATFORM,
            publishDate: { gte: new Date(Math.min(...times) - 2 * 86_400_000), lte: new Date(Math.max(...times) + 2 * 86_400_000) },
          },
        ],
      },
      select: { id: true, title: true, publishDate: true, link: true, platformPostId: true },
    }) : [];

    // Pairs made on an earlier night stay; content already paired with any video is not paired again.
    const known = new Map<string, string>();
    for (const c of contents) if (c.platformPostId) known.set(c.platformPostId, c.id);
    const taken = new Set(contents.filter(c => c.platformPostId).map(c => c.id));
    const unmatched = videos.filter(v => !known.has(v.id));
    const linked = new Map<string, string>();
    await Promise.all(contents.filter(c => !taken.has(c.id)).map(async c => {
      const videoId = await contentVideoId(c.link);
      if (videoId) linked.set(c.id, videoId);
    }));
    const byLink = matchByVideo(unmatched.map(v => ({ id: v.id, videoId: v.id })), linked, taken);
    const byText = matchPosts(unmatched.filter(v => !byLink.has(v.id)), contents, new Set([...taken, ...byLink.values()]));
    const fresh = new Map([...byLink, ...byText]);

    const writes: Prisma.PrismaPromise<unknown>[] = [];
    for (const video of videos) {
      const contentId = known.get(video.id) ?? fresh.get(video.id);
      if (!contentId) continue;
      // วันส่งจริง = the real post time (user decision 2 Nov 69).
      writes.push(prisma.content.update({
        where: { id: contentId },
        data: { submittedAt: video.createdTime, ...(fresh.has(video.id) ? { platformPostId: video.id } : {}) },
      }));
    }
    if (writes.length) await prisma.$transaction(writes);

    const due = videos
      .map(video => ({ video, contentId: known.get(video.id) ?? fresh.get(video.id) }))
      .filter((v): v is { video: typeof v.video; contentId: string } => Boolean(v.contentId) && d7Due(v.video.createdTime, now) && v.video.reach !== null);
    const recorded = due.length ? await recordOrganicReach(async tx => {
      const saved = await tx.contentMetric.createManyAndReturn({
        data: due.map(({ video, contentId }) => ({
          contentId, snapshot: D7_SNAPSHOT, recordedAt: now, reach: video.reach, views: video.views, likes: video.likes, comments: video.comments, shares: video.shares,
          source: PAGE_METRIC_SOURCE, note: `ดึงอัตโนมัติจาก TikTok (Windsor) ตอนคลิปอายุ ${postAgeDays(video.createdTime, now)} วัน`,
        })),
        skipDuplicates: true,
        select: { contentId: true },
      });
      return { result: { count: saved.length }, contentIds: saved.map(row => row.contentId) };
    }) : { count: 0 };

    await prisma.adSyncRun.update({
      where: { id: run.id },
      data: { ok: true, rows: videos.length, message: `จับคู่ใหม่ ${fresh.size} · บันทึก D+7 ${recorded.count}`, finishedAt: new Date() },
    });
    return { ok: true, videos: videos.length, matched: fresh.size, d7: recorded.count, message: null };
  } catch (error) {
    const message = safeWindsorMessage(error);
    console.error('TikTok video sync failed:', message);
    await prisma.adSyncRun.update({ where: { id: run.id }, data: { ok: false, message, finishedAt: new Date() } }).catch(() => {});
    return { ok: false, videos: 0, matched: 0, d7: 0, message };
  }
}
