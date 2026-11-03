import { parseTikTokTime } from './tiktok-posts';

export const SOCIAL_REACH_FIELDS = {
  instagram: ['media_permalink', 'media_shortcode', 'media_reach', 'timestamp'],
  tiktok_organic: ['video_id', 'video_share_url', 'video_reach', 'video_create_datetime'],
} as const;
export type SocialReachPlatform = keyof typeof SOCIAL_REACH_FIELDS;
export const SOCIAL_CONTENT_PLATFORM: Record<SocialReachPlatform, string> = { instagram: 'Instagram', tiktok_organic: 'TikTok' };
export const SOCIAL_REACH_MIN_AGE_MS = 7 * 86_400_000;

export interface SocialReachPost { id: string; url: string; postedAt: Date; reach: number | null }

/** Only full platform URLs prove the post identity; short links and look-alike hosts do not. */
export function socialPostId(platform: SocialReachPlatform, value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`); }
  catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
  if (platform === 'instagram') {
    if (!['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname.toLowerCase())) return null;
    return url.pathname.match(/^\/(?:p|reel|reels)\/([A-Za-z0-9_-]{5,64})\/?$/)?.[1] ?? null;
  }
  if (!['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'].includes(url.hostname.toLowerCase())) return null;
  return url.pathname.match(/^\/@[^/]+\/(?:video|photo)\/(\d{10,25})\/?$/)?.[1] ?? null;
}

const reachNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647 ? value : null;

/** Preserve a real zero, reject absent/invalid numbers, and never pick between conflicting duplicate rows. */
export function normalizeSocialReach(platform: SocialReachPlatform, data: unknown): { posts: SocialReachPost[]; ambiguous: number } {
  if (!Array.isArray(data)) throw new Error('Windsor returned no post list');
  const posts = new Map<string, SocialReachPost>();
  const ambiguous = new Set<string>();
  for (const value of data) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    const url = platform === 'instagram' ? row.media_permalink : row.video_share_url;
    const id = socialPostId(platform, url);
    if (!id || typeof url !== 'string') continue;
    const declaredId = platform === 'instagram' ? row.media_shortcode : row.video_id;
    if (declaredId != null && String(declaredId) !== id) { posts.delete(id); ambiguous.add(id); continue; }
    const rawTime = platform === 'instagram' ? row.timestamp : row.video_create_datetime;
    const postedAt = platform === 'tiktok_organic' ? parseTikTokTime(rawTime)
      : typeof rawTime === 'string' && /(Z|[+-]\d{2}:?\d{2})$/i.test(rawTime) ? new Date(rawTime) : null;
    if (!postedAt || !Number.isFinite(postedAt.getTime())) continue;
    const cleanUrl = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    cleanUrl.search = ''; cleanUrl.hash = '';
    const post = { id, url: cleanUrl.toString(), postedAt, reach: reachNumber(platform === 'instagram' ? row.media_reach : row.video_reach) };
    const previous = posts.get(id);
    if (previous && (previous.reach !== post.reach || previous.postedAt.getTime() !== post.postedAt.getTime())) {
      posts.delete(id); ambiguous.add(id);
    } else if (!ambiguous.has(id)) posts.set(id, post);
  }
  return { posts: [...posts.values()], ambiguous: ambiguous.size };
}
