import { JWT } from 'google-auth-library';
import { prisma } from './prisma';

export const MAX_REVIEWS_PER_BUSINESS = 10;
/** Auto-refresh on page load if last sync was more than 6 hours ago. */
const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface GbpLocationSummary {
  id: string;
  name: string;
  businessKey: string;
  placeId?: string;
  address: string;
  owner: string;
  rating: number;
  totalReviews: number;
  repliedCount: number;
  lastReviewAt: string;
  mapsUrl: string;
}

export const PLACE_IDS: Record<string, string> = {
  'loc-car': 'ChIJh5ckOqdfHTER6ayNPK4WbEw',
  'loc-gfs': 'ChIJEcaRmgmg4jARfKsd81AwsHw',
  'loc-mhl': 'ChIJeU7TVHWg4jARGRU9aOYQJoQ',
};

export interface GbpReviewItem {
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

export interface GbpSyncInfo {
  mode: 'places_api' | 'sheet_and_places';
  sheetId: string;
  sheetUrl: string;
  serviceAccountEmail: string;
  configured: boolean;
  lastSyncedAt: string | null;
  lastSyncOk: boolean | null;
  lastSyncMessage: string | null;
  scheduleText: string;
}

export const DEFAULT_LOCATIONS: GbpLocationSummary[] = [
  {
    id: 'loc-car',
    name: 'ศูนย์ติดตั้งฟิล์มรถยนต์ ครบวงจร บางนา-ลาซาล',
    businessKey: 'CAR',
    placeId: PLACE_IDS['loc-car'],
    address: '924 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260 · โทร 095-953-3949',
    owner: 'นน',
    rating: 4.9,
    totalReviews: 681,
    repliedCount: 0,
    lastReviewAt: '',
    mapsUrl: `https://www.google.com/maps/place/?q=place_id:${PLACE_IDS['loc-car']}`,
  },
  {
    id: 'loc-gfs',
    name: 'บจก.กู๊ดฟิล์ม (GOODFILM)',
    businessKey: 'GFS',
    placeId: PLACE_IDS['loc-gfs'],
    address: '914/10-11 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพมหานคร 10260',
    owner: 'แต้ว + จ๋าย',
    rating: 4.9,
    totalReviews: 110,
    repliedCount: 0,
    lastReviewAt: '',
    mapsUrl: `https://www.google.com/maps/place/?q=place_id:${PLACE_IDS['loc-gfs']}`,
  },
  {
    id: 'loc-mhl',
    name: 'Maholan Film Co., Ltd. (บริษัท มโหฬารฟิล์ม จำกัด) ฟิล์มอาคาร',
    businessKey: 'MHL',
    placeId: PLACE_IDS['loc-mhl'],
    address: '1563/125 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260 · โทร 094-998-1234',
    owner: 'เพลง',
    rating: 4.9,
    totalReviews: 90,
    repliedCount: 0,
    lastReviewAt: '',
    mapsUrl: `https://www.google.com/maps/place/?q=place_id:${PLACE_IDS['loc-mhl']}`,
  },
];

let tablesEnsured = false;

export async function ensureGbpTables() {
  if (!tablesEnsured) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GbpLocation" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "businessKey" TEXT NOT NULL DEFAULT 'GFS',
        "address" TEXT NOT NULL DEFAULT '',
        "owner" TEXT NOT NULL DEFAULT '',
        "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
        "totalReviews" INTEGER NOT NULL DEFAULT 0,
        "repliedCount" INTEGER NOT NULL DEFAULT 0,
        "lastReviewAt" TEXT NOT NULL DEFAULT '',
        "mapsUrl" TEXT NOT NULL DEFAULT '',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GbpLocation_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GbpReview" (
        "id" TEXT NOT NULL,
        "locationId" TEXT NOT NULL,
        "reviewerName" TEXT NOT NULL,
        "rating" INTEGER NOT NULL DEFAULT 5,
        "comment" TEXT NOT NULL DEFAULT '',
        "reviewDate" TEXT NOT NULL DEFAULT '',
        "replyText" TEXT NOT NULL DEFAULT '',
        "repliedBy" TEXT NOT NULL DEFAULT '',
        "source" TEXT NOT NULL DEFAULT 'Porter Metrics / GBP',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GbpReview_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GbpSyncConfig" (
        "id" TEXT NOT NULL DEFAULT 'default',
        "sheetId" TEXT NOT NULL DEFAULT '',
        "lastSyncedAt" TIMESTAMP(3),
        "lastSyncOk" BOOLEAN,
        "lastSyncMessage" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GbpSyncConfig_pkey" PRIMARY KEY ("id")
      );
    `);

    tablesEnsured = true;
  }

  const locCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "GbpLocation";`
  );
  if (Number(locCount?.[0]?.count ?? 0) === 0) {
    for (const loc of DEFAULT_LOCATIONS) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "GbpLocation" (
          "id", "name", "businessKey", "address", "owner", "rating",
          "totalReviews", "repliedCount", "lastReviewAt", "mapsUrl", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        ON CONFLICT ("id") DO NOTHING;`,
        loc.id,
        loc.name,
        loc.businessKey,
        loc.address,
        loc.owner,
        loc.rating,
        loc.totalReviews,
        loc.repliedCount,
        loc.lastReviewAt,
        loc.mapsUrl
      );
    }
  } else {
    // Clean up initial prototype mockup rows if they are still present in DB
    await prisma.$executeRawUnsafe(`
      DELETE FROM "GbpReview" WHERE "id" IN ('rev-1', 'rev-2', 'rev-3');
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "GbpLocation"
      SET "name" = 'บจก.กู๊ดฟิล์ม (GOODFILM)',
          "address" = '914/10-11 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพมหานคร 10260',
          "rating" = 4.9,
          "totalReviews" = 110,
          "repliedCount" = 0,
          "lastReviewAt" = '',
          "mapsUrl" = 'https://www.google.com/maps/search/?api=1&query=บจก.กู๊ดฟิล์ม+914/10-11+ถ.ลาซาล',
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'loc-gfs' AND "totalReviews" = 48;
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "GbpLocation"
      SET "name" = 'Maholan Film Co., Ltd. (บริษัท มโหฬารฟิล์ม จำกัด) ฟิล์มอาคาร',
          "address" = '1563/125 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260 · โทร 094-998-1234',
          "rating" = 4.9,
          "totalReviews" = 90,
          "repliedCount" = 0,
          "lastReviewAt" = '',
          "mapsUrl" = 'https://www.google.com/maps/search/?api=1&query=Maholan+Film+Co.,+Ltd.+บริษัท+มโหฬารฟิล์ม+จำกัด+ฟิล์มอาคาร',
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'loc-mhl' AND "totalReviews" = 62;
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "GbpLocation"
      SET "name" = 'ศูนย์ติดตั้งฟิล์มรถยนต์ ครบวงจร บางนา-ลาซาล',
          "address" = '924 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260 · โทร 095-953-3949',
          "rating" = 4.9,
          "totalReviews" = 681,
          "repliedCount" = 0,
          "lastReviewAt" = '',
          "mapsUrl" = 'https://www.google.com/maps/search/?api=1&query=ศูนย์ติดตั้งฟิล์มรถยนต์+ครบวงจร+บางนา-ลาซาล',
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'loc-car' AND "totalReviews" = 115;
    `);
    await prisma.$executeRawUnsafe(
      `UPDATE "GbpLocation" SET "mapsUrl" = $2 WHERE "id" = $1 AND "mapsUrl" LIKE '%/maps/search/%';`,
      'loc-car',
      `https://www.google.com/maps/place/?q=place_id:${PLACE_IDS['loc-car']}`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "GbpLocation" SET "mapsUrl" = $2 WHERE "id" = $1 AND "mapsUrl" LIKE '%/maps/search/%';`,
      'loc-gfs',
      `https://www.google.com/maps/place/?q=place_id:${PLACE_IDS['loc-gfs']}`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "GbpLocation" SET "mapsUrl" = $2 WHERE "id" = $1 AND "mapsUrl" LIKE '%/maps/search/%';`,
      'loc-mhl',
      `https://www.google.com/maps/place/?q=place_id:${PLACE_IDS['loc-mhl']}`
    );
  }
}

/** Extracts a Google Sheet ID from either a full docs.google.com URL or a raw ID. */
export function extractSheetId(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  return /^[a-zA-Z0-9-_]{15,}$/.test(trimmed) ? trimmed : '';
}

export async function getGbpSyncInfo(): Promise<GbpSyncInfo> {
  await ensureGbpTables();
  const rows = await prisma.$queryRawUnsafe<
    { sheetId: string; lastSyncedAt: Date | null; lastSyncOk: boolean | null; lastSyncMessage: string | null }[]
  >(`SELECT "sheetId", "lastSyncedAt", "lastSyncOk", "lastSyncMessage" FROM "GbpSyncConfig" WHERE "id" = 'default' LIMIT 1;`);

  const dbSheetId = rows?.[0]?.sheetId?.trim() || '';
  const envSheetId = process.env.GBP_REVIEWS_SHEET_ID?.trim() || '';
  const sheetId = dbSheetId || extractSheetId(envSheetId) || envSheetId;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || '';
  const hasCredentials = Boolean(serviceAccountEmail && process.env.GOOGLE_PRIVATE_KEY);

  return {
    mode: sheetId ? 'sheet_and_places' : 'places_api',
    sheetId,
    sheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : '',
    serviceAccountEmail,
    configured: hasCredentials,
    lastSyncedAt: rows?.[0]?.lastSyncedAt ? rows[0].lastSyncedAt.toISOString() : null,
    lastSyncOk: rows?.[0]?.lastSyncOk ?? null,
    lastSyncMessage: rows?.[0]?.lastSyncMessage ?? null,
    scheduleText: 'ดึงจาก Google Maps อัตโนมัติทุกวัน 07:00 น. (และอัปเดตเมื่อข้อมูลเก่าเกิน 6 ชม.)',
  };
}

export async function saveGbpSheetConfig(sheetUrlOrId: string): Promise<string> {
  await ensureGbpTables();
  const sheetId = extractSheetId(sheetUrlOrId);
  if (sheetUrlOrId.trim() && !sheetId) {
    throw new Error('รูปแบบลิงก์หรือรหัส Google Sheet ไม่ถูกต้อง');
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "GbpSyncConfig" ("id", "sheetId", "updatedAt")
     VALUES ('default', $1, CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE SET "sheetId" = $1, "updatedAt" = CURRENT_TIMESTAMP;`,
    sheetId
  );
  return sheetId;
}

function parseStarRating(raw: unknown): number {
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

function normalizeDate(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return new Date().toISOString().slice(0, 10);
  // YYYY-MM-DD or ISO timestamp
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${Number(y) > 2400 ? Number(y) - 543 : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // DD/MM/YYYY or M/D/YYYY
  const slash = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (slash) {
    let [, p1, p2, yRaw] = slash;
    let year = Number(yRaw);
    if (year < 100) year += 2000;
    if (year > 2400) year -= 543;
    // If first part > 12, it is DD/MM/YYYY
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
 * Reads all tabs from the configured Porter Metrics Google Sheet, parses both review rows
 * and optional location summary metrics, stores the 10 latest reviews per business in GbpReview,
 * and updates GbpLocation + GbpSyncConfig.
 */
export async function syncPorterGbpSheet(): Promise<{
  ok: boolean;
  imported: number;
  perBusiness: Record<string, number>;
  message: string;
}> {
  const info = await getGbpSyncInfo();
  if (!info.sheetId) {
    return { ok: false, imported: 0, perBusiness: {}, message: 'ยังไม่ได้ตั้งค่าลิงก์ Google Sheet' };
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return { ok: false, imported: 0, perBusiness: {}, message: 'ยังไม่มีข้อมูล Service Account ในเซิร์ฟเวอร์' };
  }

  try {
    const client = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const metaRes = await client.request<{ sheets?: { properties?: { title?: string } }[] }>({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(info.sheetId)}?fields=sheets.properties.title`,
    });

    const sheetTitles = (metaRes.data.sheets || [])
      .map(s => s.properties?.title)
      .filter((t): t is string => Boolean(t));

    if (sheetTitles.length === 0) {
      throw new Error('ไม่พบแท็บข้อมูลใน Google Sheet');
    }

    const rangesQuery = sheetTitles
      .map(title => `ranges=${encodeURIComponent(`'${title.replace(/'/g, "''")}'!A1:Z500`)}`)
      .join('&');

    const valuesRes = await client.request<{ valueRanges?: { range?: string; values?: unknown[][] }[] }>({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(info.sheetId)}/values:batchGet?${rangesQuery}`,
    });

    const groupedReviews: Record<string, GbpReviewItem[]> = {
      'loc-gfs': [],
      'loc-mhl': [],
      'loc-car': [],
    };

    const summaryStats: Record<string, { rating?: number; totalReviews?: number; repliedCount?: number }> = {};

    (valuesRes.data.valueRanges || []).forEach((vr, tabIdx) => {
      const tabTitle = sheetTitles[tabIdx] || '';
      const rows = vr.values || [];
      if (rows.length < 2) return;

      // Find header row within the first 5 rows (Porter Metrics sometimes puts a title row on row 1)
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
        /\bid\b|code|รหัส/
      );
      const dateCol = findColIndex(headers, [/^(date|review.?date|create.?time|timestamp|วันที่|วันที่รีวิว)/, /date|time|วันที่/], /reply/);
      const reviewerCol = findColIndex(headers, [/reviewer|author|customer|user.?name|display.?name|ผู้รีวิว|ชื่อลูกค้า|ลูกค้า/], /reply/);
      const ratingCol = findColIndex(headers, [/star.?rating|review.?rating|^rating$|^stars?$|ดาว|คะแนนดาว|^คะแนน$/], /average|avg|เฉลี่ย|total|count/);
      const commentCol = findColIndex(headers, [/review.?comment|review.?text|review.?body|^comment$|^text$|ข้อความรีวิว|ความคิดเห็น|^รีวิว$|^ข้อความ$/], /reply|count|rating|total/);
      const replyCol = findColIndex(headers, [/reply.?comment|review.?reply|owner.?reply|^reply$|response|ข้อความตอบกลับ|คำตอบ|ตอบกลับ/], /time|date|ผู้ตอบ/);
      const repliedByCol = findColIndex(headers, [/replied.?by|responder|ผู้ตอบ/]);

      const avgRatingCol = findColIndex(headers, [/average.?rating|avg.?rating|total.?rating|overall.?rating|คะแนนเฉลี่ย/]);
      const totalReviewsCol = findColIndex(headers, [/total.?review|review.?count|^reviews$|จำนวนรีวิว|รีวิวสะสม/]);

      for (const row of rows.slice(headerRowIndex + 1)) {
        if (!row || row.every(c => !String(c ?? '').trim())) continue;

        const locRaw = locCol >= 0 ? String(row[locCol] ?? '') : '';
        const locId = mapLocationToId(locRaw, tabTitle);
        if (!locId) continue;

        // Capture location-level summary metrics if Porter put them in a summary table/columns
        if (avgRatingCol >= 0 && row[avgRatingCol] != null && String(row[avgRatingCol]).trim() !== '') {
          const avg = Number(String(row[avgRatingCol]).replace(/[^0-9.]/g, ''));
          if (Number.isFinite(avg) && avg >= 1 && avg <= 5) {
            summaryStats[locId] = { ...summaryStats[locId], rating: Number(avg.toFixed(2)) };
          }
        }
        if (totalReviewsCol >= 0 && row[totalReviewsCol] != null && String(row[totalReviewsCol]).trim() !== '') {
          const tot = Number(String(row[totalReviewsCol]).replace(/[^0-9]/g, ''));
          if (Number.isFinite(tot) && tot >= 0) {
            summaryStats[locId] = { ...summaryStats[locId], totalReviews: tot };
          }
        }

        // Capture individual review row if reviewer or comment or rating column exists
        const hasReviewCols = reviewerCol >= 0 || commentCol >= 0;
        if (!hasReviewCols) continue;

        const reviewerName = reviewerCol >= 0 ? String(row[reviewerCol] ?? '').trim() : '';
        const comment = commentCol >= 0 ? String(row[commentCol] ?? '').trim() : '';
        const ratingVal = ratingCol >= 0 ? row[ratingCol] : 5;
        if (!reviewerName && !comment) continue;

        const reviewDate = dateCol >= 0 ? normalizeDate(row[dateCol]) : new Date().toISOString().slice(0, 10);
        const replyText = replyCol >= 0 ? String(row[replyCol] ?? '').trim() : '';
        const repliedBy = repliedByCol >= 0 ? String(row[repliedByCol] ?? '').trim() : '';

        groupedReviews[locId].push({
          id: `porter_${locId}_${groupedReviews[locId].length + 1}_${reviewDate}`,
          locationId: locId,
          reviewerName: reviewerName || 'ลูกค้า Google Maps',
          rating: parseStarRating(ratingVal),
          comment: comment || '(ให้คะแนนดาวโดยไม่มีข้อความ)',
          reviewDate,
          replyText,
          repliedBy,
          source: 'Porter Metrics Sheet',
        });
      }
    });

    let totalImported = 0;
    const perBusiness: Record<string, number> = { GFS: 0, MHL: 0, CAR: 0 };
    const idToKey: Record<string, string> = { 'loc-gfs': 'GFS', 'loc-mhl': 'MHL', 'loc-car': 'CAR' };

    for (const [locId, rawList] of Object.entries(groupedReviews)) {
      // Deduplicate by reviewer + date + comment
      const seen = new Set<string>();
      const unique = rawList.filter(item => {
        const key = `${item.reviewerName}|${item.reviewDate}|${item.comment}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const top10 = unique
        .sort((a, b) => b.reviewDate.localeCompare(a.reviewDate))
        .slice(0, MAX_REVIEWS_PER_BUSINESS);

      if (top10.length > 0) {
        const existingRows = await prisma.$queryRawUnsafe<
          { reviewerName: string; reviewDate: string; replyText: string; repliedBy: string }[]
        >(
          `SELECT "reviewerName", "reviewDate", "replyText", "repliedBy" FROM "GbpReview" WHERE "locationId" = $1;`,
          locId
        );
        const existingMap = new Map(
          existingRows.map(er => [`${er.reviewerName}|${er.reviewDate}`, er])
        );

        await prisma.$executeRawUnsafe(`DELETE FROM "GbpReview" WHERE "locationId" = $1;`, locId);
        for (let i = 0; i < top10.length; i++) {
          const r = top10[i];
          const prev = existingMap.get(`${r.reviewerName}|${r.reviewDate}`);
          const mergedReplyText = r.replyText || prev?.replyText || '';
          const mergedRepliedBy = r.repliedBy || prev?.repliedBy || '';
          const stableId = `porter_${locId}_${i + 1}_${Date.now().toString(36)}`;
          await prisma.$executeRawUnsafe(
            `INSERT INTO "GbpReview" (
              "id", "locationId", "reviewerName", "rating", "comment",
              "reviewDate", "replyText", "repliedBy", "source"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
            stableId,
            r.locationId,
            r.reviewerName,
            r.rating,
            r.comment,
            r.reviewDate,
            mergedReplyText,
            mergedRepliedBy,
            r.source
          );
          totalImported++;
        }
        perBusiness[idToKey[locId]] = top10.length;

        // Update location summary stats: preserve all-time rating/totalReviews unless Porter provides summary columns
        const newestDate = top10[0].reviewDate;
        const sheetRating = summaryStats[locId]?.rating ?? null;
        const sheetTotal = summaryStats[locId]?.totalReviews ?? unique.length;

        await prisma.$executeRawUnsafe(
          `UPDATE "GbpLocation"
           SET "rating" = COALESCE($2, "rating"),
               "totalReviews" = GREATEST("totalReviews", $3),
               "lastReviewAt" = GREATEST("lastReviewAt", $4),
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $1;`,
          locId,
          sheetRating,
          sheetTotal,
          newestDate
        );
      } else if (summaryStats[locId]) {
        const s = summaryStats[locId];
        if (s.rating != null && s.totalReviews != null) {
          await prisma.$executeRawUnsafe(
            `UPDATE "GbpLocation"
             SET "rating" = $2,
                 "totalReviews" = $3,
                 "updatedAt" = CURRENT_TIMESTAMP
             WHERE "id" = $1;`,
            locId,
            s.rating,
            s.totalReviews
          );
        }
      }
    }

    const msg =
      totalImported > 0
        ? `ดึงสำเร็จ ${totalImported} รีวิว (GFS ${perBusiness.GFS}, MHL ${perBusiness.MHL}, CAR ${perBusiness.CAR})`
        : 'เชื่อมต่อชีตสำเร็จ แต่ยังไม่พบแถวข้อมูลรีวิว (ตรวจสอบชื่อแท็บหรือคอลัมน์ในชีต)';

    await prisma.$executeRawUnsafe(
      `INSERT INTO "GbpSyncConfig" ("id", "sheetId", "lastSyncedAt", "lastSyncOk", "lastSyncMessage", "updatedAt")
       VALUES ('default', $1, CURRENT_TIMESTAMP, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE
       SET "lastSyncedAt" = CURRENT_TIMESTAMP,
           "lastSyncOk" = $2,
           "lastSyncMessage" = $3,
           "updatedAt" = CURRENT_TIMESTAMP;`,
      info.sheetId,
      totalImported > 0,
      msg
    );

    return { ok: true, imported: totalImported, perBusiness, message: msg };
  } catch (error: unknown) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    const friendly =
      rawMsg.includes('403') || rawMsg.includes('caller does not have permission')
        ? 'ยังไม่ได้แชร์สิทธิ์อ่าน Google Sheet ให้เมล Service Account ของเว็บ'
        : rawMsg.includes('404')
        ? 'ไม่พบไฟล์ Google Sheet จากลิงก์ที่ระบุ'
        : `ดึงข้อมูลไม่สำเร็จ: ${rawMsg.slice(0, 160)}`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "GbpSyncConfig" ("id", "sheetId", "lastSyncedAt", "lastSyncOk", "lastSyncMessage", "updatedAt")
       VALUES ('default', $1, CURRENT_TIMESTAMP, false, $2, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE
       SET "lastSyncedAt" = CURRENT_TIMESTAMP,
           "lastSyncOk" = false,
           "lastSyncMessage" = $2,
           "updatedAt" = CURRENT_TIMESTAMP;`,
      info.sheetId,
      friendly
    );

    return { ok: false, imported: 0, perBusiness: {}, message: friendly };
  }
}

interface PlaceApiReview {
  name?: string;
  rating?: number;
  publishTime?: string;
  authorAttribution?: { displayName?: string };
  originalText?: { text?: string };
  text?: { text?: string };
}

interface PlaceApiDetails {
  id?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: PlaceApiReview[];
}

/**
 * Fetches live rating, cumulative review count, and latest reviews directly from Official Google Places API v1
 * for all 3 businesses using the existing Google Service Account (0 manual setup, within free monthly quota).
 */
export async function fetchLiveGooglePlacesData(): Promise<{
  stats: Record<string, { rating: number; totalReviews: number; lastReviewAt: string }>;
  reviewsByLoc: Record<string, GbpReviewItem[]>;
}> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('ยังไม่มีข้อมูล Service Account ในเซิร์ฟเวอร์');
  }

  const client = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const fieldMask =
    'id,rating,userRatingCount,reviews.name,reviews.rating,reviews.publishTime,reviews.authorAttribution.displayName,reviews.originalText.text,reviews.text.text';

  const stats: Record<string, { rating: number; totalReviews: number; lastReviewAt: string }> = {};
  const reviewsByLoc: Record<string, GbpReviewItem[]> = {
    'loc-car': [],
    'loc-gfs': [],
    'loc-mhl': [],
  };

  await Promise.all(
    Object.entries(PLACE_IDS).map(async ([locId, placeId]) => {
      const [thRes, enRes] = await Promise.all([
        client.request<PlaceApiDetails>({
          url: `https://places.googleapis.com/v1/places/${placeId}?languageCode=th`,
          headers: { 'X-Goog-FieldMask': fieldMask },
        }),
        client.request<PlaceApiDetails>({
          url: `https://places.googleapis.com/v1/places/${placeId}?languageCode=en`,
          headers: { 'X-Goog-FieldMask': fieldMask },
        }),
      ]);

      const mergedMap = new Map<string, GbpReviewItem>();
      const rawList = [...(thRes.data.reviews || []), ...(enRes.data.reviews || [])];

      rawList.forEach((rev, idx) => {
        const key = rev.name || `${locId}_${idx}_${rev.publishTime || ''}`;
        if (mergedMap.has(key)) return;
        const shortHash =
          key
            .split('/')
            .pop()
            ?.slice(-18)
            .replace(/[^a-zA-Z0-9_-]/g, '') || `${idx}`;
        const reviewDate = rev.publishTime ? rev.publishTime.slice(0, 10) : new Date().toISOString().slice(0, 10);
        const reviewerName = rev.authorAttribution?.displayName?.trim() || 'ลูกค้า Google Maps';
        const comment =
          rev.originalText?.text?.trim() || rev.text?.text?.trim() || '(ให้คะแนนดาวโดยไม่มีข้อความรีวิว)';
        const rating =
          typeof rev.rating === 'number' && rev.rating >= 1 && rev.rating <= 5 ? Math.round(rev.rating) : 5;

        mergedMap.set(key, {
          id: `gmaps_${locId}_${shortHash}`,
          locationId: locId,
          reviewerName,
          rating,
          comment,
          reviewDate,
          replyText: '',
          repliedBy: '',
          source: 'Google Maps API',
        });
      });

      const sorted = [...mergedMap.values()]
        .sort((a, b) => b.reviewDate.localeCompare(a.reviewDate))
        .slice(0, MAX_REVIEWS_PER_BUSINESS);

      reviewsByLoc[locId] = sorted;
      stats[locId] = {
        rating: typeof thRes.data.rating === 'number' ? Number(thRes.data.rating.toFixed(1)) : 4.9,
        totalReviews: typeof thRes.data.userRatingCount === 'number' ? thRes.data.userRatingCount : 0,
        lastReviewAt: sorted[0]?.reviewDate || '',
      };
    })
  );

  return { stats, reviewsByLoc };
}

/**
 * Syncs live ratings, cumulative review counts, and latest reviews directly from Official Google Places API
 * into PostgreSQL, preserving any staff replies recorded in the database.
 */
export async function syncGooglePlacesDirect(): Promise<{
  ok: boolean;
  imported: number;
  perBusiness: Record<string, number>;
  message: string;
}> {
  await ensureGbpTables();
  const info = await getGbpSyncInfo();

  try {
    const { stats, reviewsByLoc } = await fetchLiveGooglePlacesData();
    let totalImported = 0;
    const perBusiness: Record<string, number> = { CAR: 0, GFS: 0, MHL: 0 };
    const idToKey: Record<string, string> = { 'loc-car': 'CAR', 'loc-gfs': 'GFS', 'loc-mhl': 'MHL' };

    for (const [locId, incoming] of Object.entries(reviewsByLoc)) {
      const existingRows = await prisma.$queryRawUnsafe<GbpReviewItem[]>(
        `SELECT "id", "locationId", "reviewerName", "rating", "comment",
                "reviewDate", "replyText", "repliedBy", "source"
         FROM "GbpReview"
         WHERE "locationId" = $1;`,
        locId
      );

      const bySig = new Map<string, GbpReviewItem>();
      for (const er of existingRows) {
        bySig.set(`${er.reviewerName}|${er.reviewDate}`, er);
      }

      const combined: GbpReviewItem[] = [];
      const usedSigs = new Set<string>();

      for (const inc of incoming) {
        const sig = `${inc.reviewerName}|${inc.reviewDate}`;
        const prev = bySig.get(sig);
        usedSigs.add(sig);
        combined.push({
          ...inc,
          replyText: inc.replyText || prev?.replyText || '',
          repliedBy: inc.repliedBy || prev?.repliedBy || '',
        });
      }

      // Keep any previously accumulated real reviews so total stays up to 10 as new reviews arrive
      for (const er of existingRows) {
        const sig = `${er.reviewerName}|${er.reviewDate}`;
        if (!usedSigs.has(sig)) {
          usedSigs.add(sig);
          combined.push(er);
        }
      }

      const top10 = combined
        .sort((a, b) => b.reviewDate.localeCompare(a.reviewDate))
        .slice(0, MAX_REVIEWS_PER_BUSINESS);

      await prisma.$executeRawUnsafe(`DELETE FROM "GbpReview" WHERE "locationId" = $1;`, locId);
      for (const r of top10) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "GbpReview" (
            "id", "locationId", "reviewerName", "rating", "comment",
            "reviewDate", "replyText", "repliedBy", "source"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
          r.id,
          r.locationId,
          r.reviewerName,
          r.rating,
          r.comment,
          r.reviewDate,
          r.replyText,
          r.repliedBy,
          r.source
        );
        totalImported++;
      }
      perBusiness[idToKey[locId]] = top10.length;

      const s = stats[locId];
      if (s) {
        const newest = top10[0]?.reviewDate || s.lastReviewAt || '';
        await prisma.$executeRawUnsafe(
          `UPDATE "GbpLocation"
           SET "rating" = $2,
               "totalReviews" = $3,
               "lastReviewAt" = GREATEST("lastReviewAt", $4),
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $1;`,
          locId,
          s.rating,
          s.totalReviews,
          newest
        );
      }
    }

    const msg = `ดึงจาก Google Maps สำเร็จ ${totalImported} รีวิว (CAR ${perBusiness.CAR}, GFS ${perBusiness.GFS}, MHL ${perBusiness.MHL})`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "GbpSyncConfig" ("id", "sheetId", "lastSyncedAt", "lastSyncOk", "lastSyncMessage", "updatedAt")
       VALUES ('default', $1, CURRENT_TIMESTAMP, true, $2, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE
       SET "lastSyncedAt" = CURRENT_TIMESTAMP,
           "lastSyncOk" = true,
           "lastSyncMessage" = $2,
           "updatedAt" = CURRENT_TIMESTAMP;`,
      info.sheetId,
      msg
    );

    return { ok: true, imported: totalImported, perBusiness, message: msg };
  } catch (error: unknown) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    const friendly = `ดึงจาก Google Maps ไม่สำเร็จ: ${rawMsg.slice(0, 160)}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "GbpSyncConfig" ("id", "sheetId", "lastSyncedAt", "lastSyncOk", "lastSyncMessage", "updatedAt")
       VALUES ('default', $1, CURRENT_TIMESTAMP, false, $2, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE
       SET "lastSyncedAt" = CURRENT_TIMESTAMP,
           "lastSyncOk" = false,
           "lastSyncMessage" = $2,
           "updatedAt" = CURRENT_TIMESTAMP;`,
      info.sheetId,
      friendly
    );
    return { ok: false, imported: 0, perBusiness: {}, message: friendly };
  }
}

/**
 * Unified daily/on-demand sync:
 * - If a Porter Metrics Google Sheet is linked, syncs reviews + replies from Sheet AND refreshes live totals from Places API.
 * - Otherwise, syncs ratings, cumulative review counts, and latest reviews directly from Official Google Places API (zero setup).
 */
export async function syncGbpReviews(): Promise<{
  ok: boolean;
  imported: number;
  perBusiness: Record<string, number>;
  message: string;
}> {
  const info = await getGbpSyncInfo();
  if (info.sheetId) {
    const sheetRes = await syncPorterGbpSheet();
    // Also refresh live rating & cumulative review count from Google Places API
    try {
      const { stats } = await fetchLiveGooglePlacesData();
      for (const [locId, s] of Object.entries(stats)) {
        await prisma.$executeRawUnsafe(
          `UPDATE "GbpLocation" SET "rating" = $2, "totalReviews" = $3, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1;`,
          locId,
          s.rating,
          s.totalReviews
        );
      }
    } catch {
      // Non-fatal if sheet sync already succeeded
    }
    return sheetRes;
  }
  return syncGooglePlacesDirect();
}

export async function maybeAutoSyncGbpSheet(): Promise<void> {
  const info = await getGbpSyncInfo();
  if (!info.configured) return;
  const lastMs = info.lastSyncedAt ? new Date(info.lastSyncedAt).getTime() : 0;
  if (!lastMs || Date.now() - lastMs > AUTO_SYNC_INTERVAL_MS) {
    await syncGbpReviews();
  }
}
