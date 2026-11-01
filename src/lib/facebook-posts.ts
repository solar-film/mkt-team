import { bangkokDateKey } from './bangkok-date';

/**
 * Facebook page posts from Windsor.ai (facebook_organic) and how they become D+7 reach.
 *
 * Most content items store a facebook.com/share/… link, which carries no post id, so a post is
 * matched to a content item by its text and day instead: the start of the content title must
 * appear near the start of the post, and the post day must be the publish day or one day apart.
 * Reach is Windsor's running total when pulled, so the D+7 figure is recorded only while a post is
 * 7–9 days old; older posts (e.g. a first backfill) are kept but never recorded as D+7.
 */
export const FACEBOOK_POST_FIELDS = [
  'post_id', 'post_created_time', 'post_message', 'post_total_media_view_unique', 'post_reactions_total', 'post_comments_total',
] as const;
export const D7_SNAPSHOT = 'D+7';
export const D7_MIN_DAYS = 7;
export const D7_MAX_DAYS = 9;

export interface FacebookPostRow {
  id: string;
  pageId: string;
  createdTime: Date;
  message: string;
  reach: number | null;
  reactions: number | null;
  comments: number | null;
}

const count = (value: unknown): number | null => {
  const n = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(n) ? null : Math.round(n);
};

/** Windsor rows → posts, deduplicated by post id; rows without id or time are dropped. */
export function normalizeFacebookPosts(data: unknown): FacebookPostRow[] {
  if (!Array.isArray(data)) throw new Error('Windsor returned no post list');
  const posts = new Map<string, FacebookPostRow>();
  for (const raw of data as Record<string, unknown>[]) {
    const id = typeof raw.post_id === 'string' ? raw.post_id.trim() : '';
    const createdTime = new Date(String(raw.post_created_time ?? ''));
    if (!id || Number.isNaN(createdTime.getTime())) continue;
    posts.set(id, {
      id,
      pageId: id.split('_')[0],
      createdTime,
      message: String(raw.post_message ?? '').slice(0, 2000),
      reach: count(raw.post_total_media_view_unique),
      reactions: count(raw.post_reactions_total),
      comments: count(raw.post_comments_total),
    });
  }
  return [...posts.values()];
}

/** Letters and digits only (Thai marks kept), lower case: emoji, spaces and punctuation differ between title and post. */
export const squashText = (text: string) => text.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '');

const TITLE_KEY_LENGTH = 40;
const MESSAGE_SEARCH_LENGTH = 600;
// Less than this much title text (e.g. "HI-CM 35") is too generic to identify a post.
const MIN_TITLE_LETTERS = 8;
// Share of the title's letters, word by word, that must appear in the opening of the post.
const MIN_WORD_SHARE = 0.75;

export interface MatchCandidate { id: string; title: string; publishDate: Date | null }

const dayNumber = (value: Date) => Date.parse(`${bangkokDateKey(value)}T00:00:00Z`) / 86_400_000;

/** Title words (2+ letters), squashed. Thai runs without spaces count as one long word. */
const titleWords = (title: string) => title.split(/[^\p{L}\p{M}\p{N}]+/u).map(squashText).filter(word => word.length >= 2);

/**
 * How well a title fits a post's opening text: 2 when the title's start appears as is, otherwise
 * the share of title letters whose word appears in the text (titles often reorder or shorten the
 * post's first line, e.g. "MAZDA 6E 3M Ceramic Ultra Clear" for "MAZDA 6E จัดฟิล์ม… 3M Ceramic Ultra Clear").
 */
export function titleScore(title: string, text: string): number {
  const squashed = squashText(title);
  if (squashed.length < MIN_TITLE_LETTERS) return 0;
  if (text.includes(squashed.slice(0, TITLE_KEY_LENGTH))) return 2;
  const words = titleWords(title);
  // The first word names the subject (car model, film, topic); shared words like "3M Ceramic" do not.
  if (!words.length || !text.includes(words[0])) return 0;
  const letters = words.reduce((sum, word) => sum + word.length, 0);
  const found = words.filter(word => text.includes(word)).reduce((sum, word) => sum + word.length, 0);
  return letters ? found / letters : 0;
}

/**
 * Pairs posts with content items published the same day or one day apart. Pairs are taken best
 * fit first across all posts (then the closer day), so a loosely similar post cannot take the
 * content item of the post it really belongs to. A post whose two best options tie stays unmatched
 * rather than guess, and each content item takes at most one post.
 */
export function matchPosts(posts: Pick<FacebookPostRow, 'id' | 'createdTime' | 'message'>[], candidates: MatchCandidate[], taken = new Set<string>()): Map<string, string> {
  const dated = candidates.filter(c => c.publishDate && !taken.has(c.id)).map(c => ({ ...c, day: dayNumber(c.publishDate!) }));
  const pairs: { post: string; content: string; score: number; gap: number }[] = [];
  const ambiguous = new Set<string>();
  for (const post of posts) {
    const text = squashText(post.message).slice(0, MESSAGE_SEARCH_LENGTH);
    const day = dayNumber(post.createdTime);
    const fits = dated
      .filter(c => Math.abs(c.day - day) <= 1)
      .map(c => ({ post: post.id, content: c.id, score: titleScore(c.title, text), gap: Math.abs(c.day - day) }))
      .filter(c => c.score >= MIN_WORD_SHARE)
      .sort((a, b) => b.score - a.score || a.gap - b.gap);
    if (fits.length > 1 && fits[0].score === fits[1].score && fits[0].gap === fits[1].gap) ambiguous.add(post.id);
    pairs.push(...fits);
  }
  pairs.sort((a, b) => b.score - a.score || a.gap - b.gap);
  const matches = new Map<string, string>();
  const used = new Set<string>();
  for (const pair of pairs) {
    if (ambiguous.has(pair.post) || matches.has(pair.post) || used.has(pair.content)) continue;
    matches.set(pair.post, pair.content);
    used.add(pair.content);
  }
  return matches;
}

/** Whole days since the post went up, counted in Thai calendar days. */
export const postAgeDays = (createdTime: Date, now = new Date()) => dayNumber(now) - dayNumber(createdTime);

export const d7Due = (createdTime: Date, now = new Date()) => {
  const age = postAgeDays(createdTime, now);
  return age >= D7_MIN_DAYS && age <= D7_MAX_DAYS;
};

export type BackfillAction = 'create' | 'fill' | 'keep';

/**
 * Filling past months from Windsor (user's rule, 1 Nov 69): a content item without D+7 gets one,
 * a D+7 whose reach is empty or 0 takes the page's figure, and any other typed reach stays.
 * The page figure is the running total on the day it is pulled, not the exact day-7 number.
 */
export function backfillAction(existing: { reach: number | null } | null): BackfillAction {
  if (!existing) return 'create';
  return existing.reach === null || existing.reach === 0 ? 'fill' : 'keep';
}

/** "YYYY-MM" → that month's first day and its last day, cut at `today` (all YYYY-MM-DD); null if invalid or not started. */
export function backfillRange(month: string, today: string): { from: string; to: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < '2025-01') return null;
  const from = `${month}-01`;
  if (from > today) return null;
  const [y, m] = month.split('-').map(Number);
  const end = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  return { from, to: end < today ? end : today };
}

/**
 * A backfill month in runs of at most BACKFILL_PART_DAYS days. A whole month of four pages with
 * post text takes Windsor close to a minute, past the 60-second limit of one request, so the admin
 * page pulls it part by part.
 */
export const BACKFILL_PART_DAYS = 7;
export function backfillParts(month: string, today: string): { from: string; to: string }[] {
  const range = backfillRange(month, today);
  if (!range) return [];
  const parts: { from: string; to: string }[] = [];
  for (let day = Number(range.from.slice(8)); ; day += BACKFILL_PART_DAYS) {
    const from = `${month}-${String(day).padStart(2, '0')}`;
    if (from > range.to) break;
    const end = `${month}-${String(day + BACKFILL_PART_DAYS - 1).padStart(2, '0')}`;
    parts.push({ from, to: end < range.to ? end : range.to });
  }
  return parts;
}
