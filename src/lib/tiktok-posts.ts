/**
 * TikTok videos from Windsor.ai (tiktok_organic) and how they become a content item's real post
 * time and D+7 reach. Same rules as Facebook (see facebook-posts.ts): a video is paired with a
 * content item by the video number in the content's link, otherwise by caption text and day;
 * reach is recorded as D+7 only while the video is 7–9 days old.
 */
export const TIKTOK_SYNC_PLATFORM = 'tiktok_organic';
export const TIKTOK_CONTENT_PLATFORM = 'TikTok';
export const TIKTOK_VIDEO_FIELDS = [
  'video_id', 'video_create_datetime', 'video_caption', 'video_reach', 'video_views_count', 'video_likes', 'video_comments', 'video_shares',
] as const;

export interface TikTokVideoRow {
  id: string;
  createdTime: Date;
  message: string;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null);

/**
 * Windsor gives the post time without a zone ("2026-10-23T11:00:00"); it is UTC (checked 2 Nov 69
 * against the time inside the video number), so it is read as UTC whatever the server's zone.
 */
export function parseTikTokTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim().replace(' ', 'T');
  const zoned = /(Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`;
  const date = new Date(zoned);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Windsor rows → videos, deduplicated by video id; rows without id or time are dropped. */
export function normalizeTikTokVideos(data: unknown): TikTokVideoRow[] {
  if (!Array.isArray(data)) throw new Error('Windsor returned no video list');
  const videos = new Map<string, TikTokVideoRow>();
  for (const raw of data as Record<string, unknown>[]) {
    const id = typeof raw.video_id === 'string' || typeof raw.video_id === 'number' ? String(raw.video_id).trim() : '';
    const createdTime = parseTikTokTime(raw.video_create_datetime);
    if (!/^\d+$/.test(id) || !createdTime) continue;
    videos.set(id, {
      id,
      createdTime,
      message: String(raw.video_caption ?? '').slice(0, 2000),
      reach: count(raw.video_reach),
      views: count(raw.video_views_count),
      likes: count(raw.video_likes),
      comments: count(raw.video_comments),
      shares: count(raw.video_shares),
    });
  }
  return [...videos.values()];
}

/** The video number in a TikTok link: tiktok.com/@user/video/<n>, /photo/<n> or /v/<n>. Short links carry none. */
export function tiktokVideoIdFromUrl(url: string | null | undefined): string | null {
  if (!url || !/tiktok\.com/i.test(url)) return null;
  const match = url.match(/\/(?:video|photo|v)\/(\d{10,25})/i);
  return match ? match[1] : null;
}

/** vt.tiktok.com/…, vm.tiktok.com/… and tiktok.com/t/… redirect to the full link with the video number. */
export const isTikTokShortLink = (url: string | null | undefined) =>
  /^(https?:\/\/)?((vt|vm)\.tiktok\.com\/|(www\.)?tiktok\.com\/t\/)/i.test(url?.trim() ?? '');
