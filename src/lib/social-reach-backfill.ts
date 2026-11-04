import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { bangkokDateKey } from './bangkok-date';
import { fetchWindsorConnector, safeWindsorMessage } from './windsor';
import { D7_SNAPSHOT, PAGE_METRIC_SOURCE } from './facebook-posts';
import { normalizeSocialReach, socialPostId, SOCIAL_CONTENT_PLATFORM, SOCIAL_REACH_FIELDS, SOCIAL_REACH_MIN_AGE_MS, type SocialReachPlatform } from './social-reach';
import { recordOrganicReach } from './organic-reach';

export interface SocialReachResult {
  ok: boolean; posts: number; matched: number; created: number; filled: number; kept: number;
  young: number; missingReach: number; unmatched: number; ambiguous: number; message: string | null;
}

/** Historical totals by exact links. Saving Reach also sets Organic; dates and links are kept. */
export async function backfillSocialReach(platform: SocialReachPlatform, from: string, to: string, now = new Date()): Promise<SocialReachResult> {
  const result: SocialReachResult = { ok: false, posts: 0, matched: 0, created: 0, filled: 0, kept: 0, young: 0, missingReach: 0, unmatched: 0, ambiguous: 0, message: null };
  try {
    const normalized = normalizeSocialReach(platform, await fetchWindsorConnector(platform, from, to, [...SOCIAL_REACH_FIELDS[platform]], 40_000));
    result.posts = normalized.posts.length + normalized.ambiguous;
    result.ambiguous = normalized.ambiguous;
    const byId = new Map(normalized.posts.map(post => [post.id, post]));
    const contents = byId.size ? await prisma.content.findMany({
      where: { platform: { equals: SOCIAL_CONTENT_PLATFORM[platform], mode: 'insensitive' } },
      select: { id: true, link: true, metrics: { where: { snapshot: D7_SNAPSHOT }, select: { id: true, reach: true, note: true, source: true } } },
    }) : [];
    const seenPosts = new Set<string>();
    const writes: ((tx: Prisma.TransactionClient) => Prisma.PrismaPromise<{ count: number }>)[] = [];
    const contentIds: string[] = [];
    const actions: ('created' | 'filled')[] = [];
    for (const content of contents) {
      const postId = socialPostId(platform, content.link);
      const post = postId ? byId.get(postId) : null;
      if (!post) continue;
      seenPosts.add(post.id);
      result.matched++;
      if (now.getTime() - post.postedAt.getTime() < SOCIAL_REACH_MIN_AGE_MS) { result.young++; continue; }
      if (post.reach === null) { result.missingReach++; continue; }
      const existing = content.metrics[0];
      // Zero is a number already recorded, not a missing number.
      if (existing && existing.reach !== null) { result.kept++; continue; }
      const note = `Reach จาก ${SOCIAL_CONTENT_PLATFORM[platform]} (Windsor) ย้อนหลัง: ยอดสะสม ณ ${bangkokDateKey(now)} ไม่ใช่ยอดวันที่ 7 พอดี · ${post.url}`;
      if (!existing) {
        writes.push(tx => tx.contentMetric.createMany({ data: [{ contentId: content.id, snapshot: D7_SNAPSHOT, reach: post.reach, recordedAt: now, source: PAGE_METRIC_SOURCE, note }], skipDuplicates: true }));
        actions.push('created');
      } else {
        // Compare-and-set also protects a number or note entered while Windsor was loading.
        writes.push(tx => tx.contentMetric.updateMany({
          where: { id: existing.id, reach: null, note: existing.note, source: existing.source },
          data: { reach: post.reach, recordedAt: now, source: PAGE_METRIC_SOURCE, note: existing.note ? `${existing.note} · ${note}` : note },
        }));
        actions.push('filled');
      }
      contentIds.push(content.id);
    }
    result.unmatched = normalized.posts.length - seenPosts.size;
    if (writes.length) {
      const saved = await recordOrganicReach(async tx => {
        const saved = await Promise.all(writes.map(write => write(tx)));
        return { result: saved, contentIds: contentIds.filter((_, index) => saved[index].count > 0) };
      });
      saved.forEach((write, index) => { if (write.count) result[actions[index]] += write.count; else result.kept++; });
    }
    result.ok = true;
  } catch (error) { result.message = safeWindsorMessage(error); }
  return result;
}
