import { createHash } from 'node:crypto';

/** Same shape as GbpReviewItem in gbp-sync.ts (kept here so this parser has no database imports and can be unit-tested). */
export interface PorterReviewRow {
  id: string;
  locationId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  reviewDate: string;
  replyText: string;
  repliedBy: string;
  source: string;
}

export const PORTER_SOURCE = 'Porter Metrics Sheet';
export const LOCATION_IDS = ['loc-car', 'loc-gfs', 'loc-mhl'] as const;

export interface PorterParseResult {
  reviewsByLoc: Record<string, PorterReviewRow[]>;
  statsByLoc: Record<string, { rating?: number; totalReviews?: number }>;
}

export function parseStarRating(raw: unknown): number {
  const s = String(raw ?? '').trim().toUpperCase();
  if (!s) return 5;
  const wordMap: Record<string, number> = {
    FIVE: 5,
    STAR_RATING_FIVE: 5,
    FOUR: 4,
    STAR_RATING_FOUR: 4,
    THREE: 3,
    STAR_RATING_THREE: 3,
    TWO: 2,
    STAR_RATING_TWO: 2,
    ONE: 1,
    STAR_RATING_ONE: 1,
  };
  if (wordMap[s]) return wordMap[s];
  const starChars = (s.match(/★/g) || []).length;
  if (starChars >= 1 && starChars <= 5) return starChars;
  const num = Number(s.replace(/[^0-9.]/g, ''));
  if (Number.isFinite(num) && num >= 1 && num <= 5) return Math.round(num);
  return 5;
}

export function normalizeDate(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return new Date().toISOString().slice(0, 10);
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${Number(y) > 2400 ? Number(y) - 543 : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const slash = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (slash) {
    const [, p1, p2, yRaw] = slash;
    let year = Number(yRaw);
    if (year < 100) year += 2000;
    if (year > 2400) year -= 543;
    const isDayFirst = Number(p1) > 12;
    const month = isDayFirst ? p2 : p1;
    const day = isDayFirst ? p1 : p2;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function matchSingleLocationText(text: string): string | null {
  const s = (text || '').toLowerCase();
  if (!s.trim()) return null;
  if (/car|รถยนต์|ฟิล์มรถ/.test(s)) return 'loc-car';
  if (/gfs|good\s*film|goodfilm|กู๊ดฟิล์ม/.test(s)) return 'loc-gfs';
  if (/mhl|maholan|มโหฬาร/.test(s)) return 'loc-mhl';
  return null;
}

export function mapLocationToId(locationText: string, fallbackTabTitle = ''): string | null {
  return matchSingleLocationText(locationText) ?? matchSingleLocationText(fallbackTabTitle);
}

function findColIndex(headers: string[], matchers: RegExp[], exclude?: RegExp): number {
  for (const regex of matchers) {
    const idx = headers.findIndex(h => regex.test(h) && (!exclude || !exclude.test(h)));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Stable id per Google review so repeated syncs upsert the same row instead of duplicating it.
 * Porter does not expose the review id, so the creation time (to the second) + text identify a review.
 */
export function porterReviewId(locId: string, rawCreateTime: string, reviewerName: string, comment: string): string {
  const hash = createHash('sha1')
    .update(`${locId}|${rawCreateTime.trim()}|${reviewerName.trim()}|${comment.trim()}`)
    .digest('hex')
    .slice(0, 16);
  return `porter_${locId}_${hash}`;
}

/**
 * Parses every tab of a Porter Metrics Google Business Profile export.
 * Column names are matched loosely (Porter labels such as "Review comment", "Review creation date",
 * "Review reply comment", or raw field ids such as reviewComment / reviewerReplyComment).
 */
export function parsePorterSheet(
  tabs: { title: string; values: unknown[][] }[]
): PorterParseResult {
  const reviewsByLoc: Record<string, PorterReviewRow[]> = { 'loc-car': [], 'loc-gfs': [], 'loc-mhl': [] };
  const statsByLoc: Record<string, { rating?: number; totalReviews?: number }> = {};
  const seenIds = new Set<string>();

  for (const tab of tabs) {
    const rows = tab.values || [];
    if (rows.length < 2) continue;

    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const candidate = (rows[i] || []).map(c => String(c ?? '').toLowerCase());
      const score = candidate.filter(c =>
        /review|rating|star|comment|author|location|business|วันที่|รีวิว|คะแนน|ดาว|ธุรกิจ|สถานที่|ลูกค้า/.test(c)
      ).length;
      if (score >= 2) {
        headerRowIndex = i;
        break;
      }
    }

    const headers = (rows[headerRowIndex] || []).map(c => String(c ?? '').trim().toLowerCase());
    const locCol = findColIndex(
      headers,
      [
        /location.?name|business.?name|store.?name|account.?name|profile.?name|ชื่อธุรกิจ|ชื่อสถานที่|ชื่อสาขา|ชื่อร้าน/,
        /location|account|business|store|profile|branch|title|ธุรกิจ|สถานที่|สาขา/,
      ],
      /\bid\b|code|รหัส|pending|duplicate/
    );
    const dateCol = findColIndex(
      headers,
      [/creation.?(date|time)|create.?time/, /^(date|review.?date|timestamp|วันที่|วันที่รีวิว)/, /date|time|วันที่/],
      /reply|respond|update|frame/
    );
    const reviewerCol = findColIndex(headers, [/reviewer|author|customer|user.?name|display.?name|ผู้รีวิว|ชื่อลูกค้า|ลูกค้า/], /reply|photo/);
    const ratingCol = findColIndex(
      headers,
      [/star.?rating|integer.?rating|review.?rating|^rating$|^stars?$|ดาว|คะแนนดาว|^คะแนน$/],
      /average|avg|เฉลี่ย|total|count/
    );
    const commentCol = findColIndex(
      headers,
      [/review.?comment|review.?text|review.?body|^comment$|^text$|ข้อความรีวิว|ความคิดเห็น|^รีวิว$|^ข้อความ$/],
      /reply|count|rating|total/
    );
    const replyCol = findColIndex(
      headers,
      [/reply.?comment|review.?reply|owner.?reply|^reply$|response|ข้อความตอบกลับ|คำตอบ|ตอบกลับ/],
      /time|date|hours|ผู้ตอบ/
    );
    const repliedByCol = findColIndex(headers, [/replied.?by|responder|ผู้ตอบ/]);
    const avgRatingCol = findColIndex(headers, [/total.?average/, /^average.?rating|^avg.?rating|overall.?rating|คะแนนเฉลี่ย/]);
    const totalReviewsCol = findColIndex(
      headers,
      [/total.?review.?count|^total.?reviews?$|review.?total.?count|จำนวนรีวิว|รีวิวสะสม/],
      /frame|ช่วง/
    );

    for (const row of rows.slice(headerRowIndex + 1)) {
      if (!row || row.every(c => !String(c ?? '').trim())) continue;
      const locRaw = locCol >= 0 ? String(row[locCol] ?? '') : '';
      const locId = mapLocationToId(locRaw, tab.title);
      if (!locId) continue;

      if (avgRatingCol >= 0 && String(row[avgRatingCol] ?? '').trim() !== '') {
        const avg = Number(String(row[avgRatingCol]).replace(/[^0-9.]/g, ''));
        if (Number.isFinite(avg) && avg >= 1 && avg <= 5) {
          statsByLoc[locId] = { ...statsByLoc[locId], rating: Number(avg.toFixed(2)) };
        }
      }
      if (totalReviewsCol >= 0 && String(row[totalReviewsCol] ?? '').trim() !== '') {
        const tot = Number(String(row[totalReviewsCol]).replace(/[^0-9]/g, ''));
        if (Number.isFinite(tot) && tot > 0) {
          statsByLoc[locId] = { ...statsByLoc[locId], totalReviews: tot };
        }
      }

      if (reviewerCol < 0 && commentCol < 0) continue;
      const reviewerName = reviewerCol >= 0 ? String(row[reviewerCol] ?? '').trim() : '';
      const comment = commentCol >= 0 ? String(row[commentCol] ?? '').trim() : '';
      const rawDate = dateCol >= 0 ? String(row[dateCol] ?? '').trim() : '';
      // Rows without any review content (e.g. daily metric rows) are skipped; star-only reviews still have a creation time
      if (!reviewerName && !comment && !rawDate) continue;

      const id = porterReviewId(locId, rawDate, reviewerName, comment);
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      reviewsByLoc[locId].push({
        id,
        locationId: locId,
        reviewerName: reviewerName || 'ลูกค้า Google Maps',
        rating: parseStarRating(ratingCol >= 0 ? row[ratingCol] : 5),
        comment: comment || '(ให้คะแนนดาวโดยไม่มีข้อความรีวิว)',
        reviewDate: normalizeDate(rawDate),
        replyText: replyCol >= 0 ? String(row[replyCol] ?? '').trim() : '',
        repliedBy: repliedByCol >= 0 ? String(row[repliedByCol] ?? '').trim() : '',
        source: PORTER_SOURCE,
      });
    }
  }

  for (const locId of Object.keys(reviewsByLoc)) {
    reviewsByLoc[locId].sort((a, b) => b.reviewDate.localeCompare(a.reviewDate));
  }

  return { reviewsByLoc, statsByLoc };
}
