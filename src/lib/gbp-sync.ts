import { revalidateTag, unstable_cache } from 'next/cache';
import { JWT } from 'google-auth-library';
import { prisma } from './prisma';
import { parsePorterSheet, PORTER_SOURCE } from './gbp-porter';

export const MAX_REVIEWS_PER_BUSINESS = 10;
const PORTER_KEEP_PER_BUSINESS = 50; // history kept in DB per business (Porter free plan only exposes the last 30 days)
const PLACES_CACHE_TAG = 'gbp-places';
const PLACES_CACHE_SECONDS = 3600; // 1 hour server-side Data Cache; daily 07:00 cron also persists to DB

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
  mode: 'places_api' | 'sheet_and_places' | 'porter';
  sheetId: string;
  sheetUrl: string;
  /** Porter Metrics export sheet that supplies the newest reviews + owner replies (read-only, separate from sheetId). */
  porterSheetId: string;
  porterSheetUrl: string;
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

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then(val => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

let tablesVerified = false;

/**
 * Ensures GBP tables exist in PostgreSQL (only runs DDL if tables are missing, avoiding catalog locks).
 * Called only on write/sync paths (POST, PUT, DELETE, Cron), never blocking GET.
 */
export async function ensureGbpTables() {
  if (tablesVerified) return;

  const check = await prisma
    .$queryRawUnsafe<{ loc: string | null; rev: string | null; cfg: string | null }[]>(
      `SELECT to_regclass('public."GbpLocation"')::text AS loc,
              to_regclass('public."GbpReview"')::text AS rev,
              to_regclass('public."GbpSyncConfig"')::text AS cfg;`
    )
    .catch(() => []);

  const existsAll = Boolean(check?.[0]?.loc && check?.[0]?.rev && check?.[0]?.cfg);

  if (!existsAll) {
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
        "source" TEXT NOT NULL DEFAULT 'Google Maps API',
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
  }

  const porterCol = await prisma
    .$queryRawUnsafe<{ ok: number }[]>(
      `SELECT 1 AS ok FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'GbpSyncConfig' AND column_name = 'porterSheetId';`
    )
    .catch(() => []);
  if (porterCol.length === 0) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "GbpSyncConfig" ADD COLUMN IF NOT EXISTS "porterSheetId" TEXT NOT NULL DEFAULT '';`
    );
  }

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

  // Remove legacy prototype sample reviews if any remain
  await prisma.$executeRawUnsafe(
    `DELETE FROM "GbpReview" WHERE "id" IN ('rev-1', 'rev-2', 'rev-3');`
  );

  tablesVerified = true;
}

/** Extracts a Google Sheet ID from either a full docs.google.com URL or a raw ID. */
export function extractSheetId(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  return /^[a-zA-Z0-9-_]{15,}$/.test(trimmed) ? trimmed : '';
}

/** Fast non-blocking sync info lookup (never runs DDL, safe for /api/data-sources and GET /api/integrations). */
export async function getGbpSyncInfo(): Promise<GbpSyncInfo> {
  // to_jsonb keeps this read working before the porterSheetId column has been added on a write path
  const rows = await withTimeout(
    prisma.$queryRawUnsafe<
      {
        row: {
          sheetId?: string;
          porterSheetId?: string;
          lastSyncedAt?: string | null;
          lastSyncOk?: boolean | null;
          lastSyncMessage?: string | null;
        };
      }[]
    >(`SELECT to_jsonb(c) AS row FROM "GbpSyncConfig" c WHERE c."id" = 'default' LIMIT 1;`),
    2000,
    []
  );
  const cfg = rows?.[0]?.row;

  const dbSheetId = cfg?.sheetId?.trim() || '';
  const envSheetId = process.env.GBP_REVIEWS_SHEET_ID?.trim() || '';
  const sheetId = dbSheetId || extractSheetId(envSheetId) || envSheetId;
  const porterSheetId = cfg?.porterSheetId?.trim() || extractSheetId(process.env.GBP_PORTER_SHEET_ID || '');
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || '';
  const hasCredentials = Boolean(serviceAccountEmail && process.env.GOOGLE_PRIVATE_KEY);
  const lastSyncedAt = cfg?.lastSyncedAt ? new Date(cfg.lastSyncedAt) : null;

  return {
    mode: porterSheetId ? 'porter' : sheetId ? 'sheet_and_places' : 'places_api',
    sheetId,
    sheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : '',
    porterSheetId,
    porterSheetUrl: porterSheetId ? `https://docs.google.com/spreadsheets/d/${porterSheetId}` : '',
    serviceAccountEmail,
    configured: hasCredentials,
    lastSyncedAt: lastSyncedAt && !Number.isNaN(lastSyncedAt.getTime()) ? lastSyncedAt.toISOString() : null,
    lastSyncOk: cfg?.lastSyncOk ?? null,
    lastSyncMessage: cfg?.lastSyncMessage ?? null,
    scheduleText: porterSheetId
      ? 'ดึงรีวิวใหม่ล่าสุดพร้อมคำตอบกลับจากชีต Porter ทุกวัน 07:00 น. (คะแนนดาวและยอดรีวิวสะสมจาก Google Maps)'
      : 'ดึงจาก Google Maps อัตโนมัติทุกวัน 07:00 น. (และแคชความเร็วสูงอัปเดตทุกชั่วโมง)',
  };
}

/** Saves (or clears with an empty value) the Porter Metrics export sheet used as the review source. */
export async function savePorterSheetConfig(sheetUrlOrId: string): Promise<string> {
  await ensureGbpTables();
  const porterSheetId = extractSheetId(sheetUrlOrId);
  if (sheetUrlOrId.trim() && !porterSheetId) {
    throw new Error('รูปแบบลิงก์หรือรหัสชีต Porter ไม่ถูกต้อง');
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "GbpSyncConfig" ("id", "porterSheetId", "updatedAt")
     VALUES ('default', $1, CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE SET "porterSheetId" = $1, "updatedAt" = CURRENT_TIMESTAMP;`,
    porterSheetId
  );
  return porterSheetId;
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

export interface LivePlacesPayload {
  fetchedAt: string;
  stats: Record<string, { rating: number; totalReviews: number; lastReviewAt: string }>;
  reviewsByLoc: Record<string, GbpReviewItem[]>;
}

let cachedPlacesJwt: JWT | null = null;

function getPlacesJwt(): JWT {
  if (!cachedPlacesJwt) {
    cachedPlacesJwt = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }
  return cachedPlacesJwt;
}

/**
 * Fetches live rating, cumulative review count, and latest reviews directly from Official Google Places API v1
 * using 1 single OAuth token exchange + 6 parallel HTTP requests with strict 8s timeout (~300-500ms total).
 */
export async function fetchLiveGooglePlacesData(): Promise<LivePlacesPayload> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('ยังไม่มีข้อมูล Service Account ในเซิร์ฟเวอร์');
  }

  const jwt = getPlacesJwt();
  const tokenRes = await Promise.race([
    jwt.getAccessToken(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Google OAuth timeout')), 8000)),
  ]);
  const token = tokenRes.token;
  if (!token) throw new Error('ไม่สามารถขอ Access Token สำหรับ Google Maps API ได้');

  const fieldMask =
    'id,rating,userRatingCount,reviews.name,reviews.rating,reviews.publishTime,reviews.authorAttribution.displayName,reviews.originalText.text,reviews.text.text';

  const stats: Record<string, { rating: number; totalReviews: number; lastReviewAt: string }> = {};
  const reviewsByLoc: Record<string, GbpReviewItem[]> = {
    'loc-car': [],
    'loc-gfs': [],
    'loc-mhl': [],
  };

  const fetchPlaceLang = async (placeId: string, lang: string): Promise<PlaceApiDetails> => {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=${lang}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Goog-FieldMask': fieldMask,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new Error(`Google Places HTTP ${res.status}`);
    }
    return (await res.json()) as PlaceApiDetails;
  };

  await Promise.all(
    Object.entries(PLACE_IDS).map(async ([locId, placeId]) => {
      const [thData, enData] = await Promise.all([
        fetchPlaceLang(placeId, 'th'),
        fetchPlaceLang(placeId, 'en'),
      ]);

      const mergedMap = new Map<string, GbpReviewItem>();
      const rawList = [...(thData.reviews || []), ...(enData.reviews || [])];

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
        rating: typeof thData.rating === 'number' ? Number(thData.rating.toFixed(1)) : 4.9,
        totalReviews: typeof thData.userRatingCount === 'number' ? thData.userRatingCount : 0,
        lastReviewAt: sorted[0]?.reviewDate || '',
      };
    })
  );

  return {
    fetchedAt: new Date().toISOString(),
    stats,
    reviewsByLoc,
  };
}

/** Server-side Data Cache (<20ms on cache hit, ~400ms on cache miss). */
export const getCachedGooglePlacesData = unstable_cache(
  fetchLiveGooglePlacesData,
  ['gbp-places-live-v2'],
  { revalidate: PLACES_CACHE_SECONDS, tags: [PLACES_CACHE_TAG] }
);

/** Fast bulk upsert of reviews for a location in a single SQL statement instead of N round-trips. */
async function replaceLocationReviewsBulk(locId: string, rows: GbpReviewItem[]) {
  await prisma.$executeRawUnsafe(`DELETE FROM "GbpReview" WHERE "locationId" = $1;`, locId);
  if (rows.length === 0) return;

  const valuesSql: string[] = [];
  const params: unknown[] = [];
  rows.forEach((r, idx) => {
    const base = idx * 9;
    valuesSql.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`
    );
    params.push(
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
  });

  await prisma.$executeRawUnsafe(
    `INSERT INTO "GbpReview" (
      "id", "locationId", "reviewerName", "rating", "comment",
      "reviewDate", "replyText", "repliedBy", "source"
    ) VALUES ${valuesSql.join(', ')}
    ON CONFLICT ("id") DO UPDATE SET
      "rating" = EXCLUDED."rating",
      "comment" = EXCLUDED."comment",
      "replyText" = EXCLUDED."replyText",
      "repliedBy" = EXCLUDED."repliedBy",
      "source" = EXCLUDED."source";`,
    ...params
  );
}

/** Upserts Porter reviews without deleting older ones, so the free plan's 30-day window accumulates history day by day. */
async function upsertPorterReviewsBulk(rows: GbpReviewItem[]) {
  if (rows.length === 0) return;
  const valuesSql: string[] = [];
  const params: unknown[] = [];
  rows.forEach((r, idx) => {
    const base = idx * 9;
    valuesSql.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`
    );
    params.push(r.id, r.locationId, r.reviewerName, r.rating, r.comment, r.reviewDate, r.replyText, r.repliedBy, r.source);
  });

  // A reply found in the sheet wins; otherwise keep any reply staff recorded on the web
  await prisma.$executeRawUnsafe(
    `INSERT INTO "GbpReview" (
      "id", "locationId", "reviewerName", "rating", "comment",
      "reviewDate", "replyText", "repliedBy", "source"
    ) VALUES ${valuesSql.join(', ')}
    ON CONFLICT ("id") DO UPDATE SET
      "reviewerName" = EXCLUDED."reviewerName",
      "rating" = EXCLUDED."rating",
      "comment" = EXCLUDED."comment",
      "reviewDate" = EXCLUDED."reviewDate",
      "replyText" = CASE WHEN EXCLUDED."replyText" <> '' THEN EXCLUDED."replyText" ELSE "GbpReview"."replyText" END,
      "repliedBy" = CASE WHEN EXCLUDED."repliedBy" <> '' THEN EXCLUDED."repliedBy" ELSE "GbpReview"."repliedBy" END,
      "source" = EXCLUDED."source";`,
    ...params
  );
}

/**
 * Reads all tabs of the Porter Metrics Google Sheet (newest reviews + owner replies) and accumulates them in the DB.
 * Keeps the newest PORTER_KEEP_PER_BUSINESS rows per business; the page shows the newest MAX_REVIEWS_PER_BUSINESS.
 */
export async function syncPorterGbpSheet(sheetIdOverride?: string): Promise<{
  ok: boolean;
  imported: number;
  perBusiness: Record<string, number>;
  message: string;
}> {
  await ensureGbpTables();
  const info = await getGbpSyncInfo();
  const sheetId = sheetIdOverride || info.porterSheetId;
  if (!sheetId) {
    return { ok: false, imported: 0, perBusiness: {}, message: 'ยังไม่ได้ตั้งค่าลิงก์ชีต Porter' };
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
      url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=sheets.properties.title`,
      timeout: 10000,
    });

    const sheetTitles = (metaRes.data.sheets || [])
      .map(s => s.properties?.title)
      .filter((t): t is string => Boolean(t));

    if (sheetTitles.length === 0) {
      throw new Error('ไม่พบแท็บข้อมูลใน Google Sheet');
    }

    const rangesQuery = sheetTitles
      .map(title => `ranges=${encodeURIComponent(`'${title.replace(/'/g, "''")}'!A1:Z2000`)}`)
      .join('&');

    const valuesRes = await client.request<{ valueRanges?: { range?: string; values?: unknown[][] }[] }>({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values:batchGet?${rangesQuery}`,
      timeout: 12000,
    });

    const { reviewsByLoc, statsByLoc } = parsePorterSheet(
      (valuesRes.data.valueRanges || []).map((vr, idx) => ({ title: sheetTitles[idx] || '', values: vr.values || [] }))
    );

    let totalImported = 0;
    const perBusiness: Record<string, number> = { GFS: 0, MHL: 0, CAR: 0 };
    const idToKey: Record<string, string> = { 'loc-gfs': 'GFS', 'loc-mhl': 'MHL', 'loc-car': 'CAR' };

    for (const [locId, rows] of Object.entries(reviewsByLoc)) {
      const latest = rows.slice(0, PORTER_KEEP_PER_BUSINESS);
      if (latest.length === 0) continue;

      await upsertPorterReviewsBulk(latest);
      // Featured reviews from Places API have no replies and are not the newest; Porter replaces them for this business
      await prisma.$executeRawUnsafe(
        `DELETE FROM "GbpReview" WHERE "locationId" = $1 AND "source" = 'Google Maps API';`,
        locId
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM "GbpReview"
         WHERE "locationId" = $1 AND "source" = $2
           AND "id" NOT IN (
             SELECT "id" FROM "GbpReview"
             WHERE "locationId" = $1 AND "source" = $2
             ORDER BY "reviewDate" DESC, "createdAt" DESC
             LIMIT ${PORTER_KEEP_PER_BUSINESS}
           );`,
        locId,
        PORTER_SOURCE
      );

      totalImported += latest.length;
      perBusiness[idToKey[locId]] = latest.length;

      await prisma.$executeRawUnsafe(
        `UPDATE "GbpLocation"
         SET "rating" = COALESCE($2, "rating"),
             "totalReviews" = GREATEST("totalReviews", $3),
             "lastReviewAt" = GREATEST("lastReviewAt", $4),
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $1;`,
        locId,
        statsByLoc[locId]?.rating ?? null,
        statsByLoc[locId]?.totalReviews ?? 0,
        latest[0].reviewDate
      );
    }

    const msg =
      totalImported > 0
        ? `ดึงจากชีต Porter สำเร็จ ${totalImported} รีวิว (CAR ${perBusiness.CAR}, GFS ${perBusiness.GFS}, MHL ${perBusiness.MHL})`
        : 'เชื่อมต่อชีต Porter สำเร็จ แต่ยังไม่พบแถวข้อมูลรีวิว';

    await prisma.$executeRawUnsafe(
      `INSERT INTO "GbpSyncConfig" ("id", "lastSyncedAt", "lastSyncOk", "lastSyncMessage", "updatedAt")
       VALUES ('default', CURRENT_TIMESTAMP, $1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE
       SET "lastSyncedAt" = CURRENT_TIMESTAMP,
           "lastSyncOk" = $1,
           "lastSyncMessage" = $2,
           "updatedAt" = CURRENT_TIMESTAMP;`,
      totalImported > 0,
      msg
    );

    return { ok: totalImported > 0, imported: totalImported, perBusiness, message: msg };
  } catch (error: unknown) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    const friendly =
      rawMsg.includes('403') || rawMsg.includes('caller does not have permission')
        ? 'ยังไม่ได้แชร์สิทธิ์อ่านชีต Porter ให้เมล Service Account ของเว็บ'
        : rawMsg.includes('404')
        ? 'ไม่พบไฟล์ชีต Porter จากลิงก์ที่ระบุ'
        : `ดึงข้อมูลจากชีต Porter ไม่สำเร็จ: ${rawMsg.slice(0, 160)}`;

    await prisma
      .$executeRawUnsafe(
        `INSERT INTO "GbpSyncConfig" ("id", "lastSyncedAt", "lastSyncOk", "lastSyncMessage", "updatedAt")
         VALUES ('default', CURRENT_TIMESTAMP, false, $1, CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO UPDATE
         SET "lastSyncedAt" = CURRENT_TIMESTAMP,
             "lastSyncOk" = false,
             "lastSyncMessage" = $1,
             "updatedAt" = CURRENT_TIMESTAMP;`,
        friendly
      )
      .catch(() => {});

    return { ok: false, imported: 0, perBusiness: {}, message: friendly };
  }
}

/**
 * Syncs live ratings, cumulative review counts, and latest reviews directly from Official Google Places API
 * into PostgreSQL in bulk (<800ms total), preserving any staff replies recorded in the database.
 */
/** Porter mode: Places API still gives the live rating and all-time review count, but its reviews are not stored. */
async function syncPlacesStatsOnly(): Promise<{ ok: boolean; message: string }> {
  revalidateTag(PLACES_CACHE_TAG, { expire: 0 });
  try {
    const { stats } = await fetchLiveGooglePlacesData();
    for (const [locId, s] of Object.entries(stats)) {
      await prisma.$executeRawUnsafe(
        `UPDATE "GbpLocation"
         SET "rating" = $2, "totalReviews" = $3, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $1;`,
        locId,
        s.rating,
        s.totalReviews
      );
    }
    return { ok: true, message: 'คะแนนดาวจาก Google Maps อัปเดตแล้ว' };
  } catch (error: unknown) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `คะแนนดาวจาก Google Maps อัปเดตไม่สำเร็จ: ${rawMsg.slice(0, 120)}` };
  }
}

export async function syncGooglePlacesDirect(): Promise<{
  ok: boolean;
  imported: number;
  perBusiness: Record<string, number>;
  message: string;
}> {
  revalidateTag(PLACES_CACHE_TAG, { expire: 0 });
  await ensureGbpTables();
  const info = await getGbpSyncInfo();

  try {
    const { stats, reviewsByLoc } = await fetchLiveGooglePlacesData();
    const allExisting = await prisma.$queryRawUnsafe<GbpReviewItem[]>(
      `SELECT "id", "locationId", "reviewerName", "rating", "comment",
              "reviewDate", "replyText", "repliedBy", "source"
       FROM "GbpReview";`
    );

    let totalImported = 0;
    const perBusiness: Record<string, number> = { CAR: 0, GFS: 0, MHL: 0 };
    const idToKey: Record<string, string> = { 'loc-car': 'CAR', 'loc-gfs': 'GFS', 'loc-mhl': 'MHL' };

    for (const [locId, incoming] of Object.entries(reviewsByLoc)) {
      const existingRows = allExisting.filter(r => r.locationId === locId);
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

      await replaceLocationReviewsBulk(locId, top10);
      totalImported += top10.length;
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
    await prisma
      .$executeRawUnsafe(
        `INSERT INTO "GbpSyncConfig" ("id", "sheetId", "lastSyncedAt", "lastSyncOk", "lastSyncMessage", "updatedAt")
         VALUES ('default', $1, CURRENT_TIMESTAMP, false, $2, CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO UPDATE
         SET "lastSyncedAt" = CURRENT_TIMESTAMP,
             "lastSyncOk" = false,
             "lastSyncMessage" = $2,
             "updatedAt" = CURRENT_TIMESTAMP;`,
        info.sheetId,
        friendly
      )
      .catch(() => {});
    return { ok: false, imported: 0, perBusiness: {}, message: friendly };
  }
}

/**
 * Exports all 3 businesses' live summary stats and 10 latest reviews into 4 clean tabs
 * ('สรุปคะแนน 3 ธุรกิจ', 'MHL CAR', 'GOODFILM', 'MHL อาคาร') in the linked Google Sheet.
 */
export async function exportGbpDataToSheet(
  sheetId: string,
  locations: GbpLocationSummary[],
  reviews: GbpReviewItem[]
): Promise<{ ok: boolean; message: string }> {
  if (!sheetId) return { ok: false, message: 'ยังไม่ได้ระบุรหัส Google Sheet' };
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return { ok: false, message: 'ยังไม่มีข้อมูล Service Account ในเซิร์ฟเวอร์' };
  }

  const client = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const desiredTabs = ['สรุปคะแนน 3 ธุรกิจ', 'MHL CAR', 'GOODFILM', 'MHL อาคาร'];

  try {
    const metaRes = await client.request<{
      sheets?: { properties?: { sheetId?: number; title?: string } }[];
    }>({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=sheets.properties(sheetId,title)`,
      timeout: 10000,
    });

    const existingSheets = metaRes.data.sheets || [];
    const existingTitles = new Set(existingSheets.map(s => s.properties?.title).filter(Boolean));
    const batchRequests: Record<string, unknown>[] = [];

    // Rename default blank Sheet1 / แผ่นงาน1 to the summary tab if none of our tabs exist yet
    const firstSheet = existingSheets[0]?.properties;
    const isDefaultSingleTab =
      existingSheets.length === 1 &&
      firstSheet?.sheetId != null &&
      firstSheet.title &&
      /^(Sheet1|แผ่นงาน1|ชีต1)$/i.test(firstSheet.title) &&
      !existingTitles.has(desiredTabs[0]);

    if (isDefaultSingleTab) {
      batchRequests.push({
        updateSheetProperties: {
          properties: { sheetId: firstSheet!.sheetId, title: desiredTabs[0] },
          fields: 'title',
        },
      });
      existingTitles.add(desiredTabs[0]);
    }

    for (const tabTitle of desiredTabs) {
      if (!existingTitles.has(tabTitle)) {
        batchRequests.push({ addSheet: { properties: { title: tabTitle } } });
      }
    }

    if (batchRequests.length > 0) {
      await client.request({
        method: 'POST',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}:batchUpdate`,
        data: { requests: batchRequests },
        timeout: 10000,
      });
    }

    const nowThai = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    const summaryRows: (string | number)[][] = [
      [
        'รหัสธุรกิจ',
        'ชื่อธุรกิจ',
        'ชื่อหมุดบน Google Maps',
        'คะแนนดาวเฉลี่ย',
        'รีวิวสะสมทั้งหมด',
        'จำนวนรีวิวล่าสุดในชีต',
        'วันที่รีวิวล่าสุด',
        'ผู้ดูแล',
        'ลิงก์ Google Maps',
        'อัปเดตล่าสุดเมื่อ',
      ],
      ...locations.map(loc => {
        const locRevs = reviews.filter(r => r.locationId === loc.id).slice(0, MAX_REVIEWS_PER_BUSINESS);
        const label =
          loc.businessKey === 'CAR'
            ? 'MHL CAR (ศูนย์ฟิล์มรถยนต์)'
            : loc.businessKey === 'GFS'
            ? 'GOODFILM (GFS B2B / B2C)'
            : 'MHL อาคาร (มโหฬารฟิล์ม)';
        return [
          loc.businessKey,
          label,
          loc.name,
          loc.rating,
          loc.totalReviews,
          locRevs.length,
          locRevs[0]?.reviewDate || loc.lastReviewAt || '-',
          loc.owner,
          loc.mapsUrl,
          nowThai,
        ];
      }),
    ];

    const buildReviewRows = (locId: string): (string | number)[][] => {
      const list = reviews.filter(r => r.locationId === locId).slice(0, MAX_REVIEWS_PER_BUSINESS);
      return [
        ['ลำดับ', 'วันที่รีวิว', 'ชื่อผู้รีวิว', 'คะแนนดาว', 'ข้อความรีวิว', 'คำตอบกลับของทีม', 'ผู้ตอบกลับ', 'แหล่งข้อมูล'],
        ...list.map((r, idx) => [
          idx + 1,
          r.reviewDate,
          r.reviewerName,
          r.rating,
          r.comment,
          r.replyText || '',
          r.repliedBy || '',
          r.source || 'Google Maps API',
        ]),
      ];
    };

    await client.request({
      method: 'POST',
      url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values:batchClear`,
      data: {
        ranges: desiredTabs.map(t => `'${t}'!A1:J100`),
      },
      timeout: 10000,
    });

    await client.request({
      method: 'POST',
      url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values:batchUpdate`,
      data: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'สรุปคะแนน 3 ธุรกิจ'!A1`, values: summaryRows },
          { range: `'MHL CAR'!A1`, values: buildReviewRows('loc-car') },
          { range: `'GOODFILM'!A1`, values: buildReviewRows('loc-gfs') },
          { range: `'MHL อาคาร'!A1`, values: buildReviewRows('loc-mhl') },
        ],
      },
      timeout: 12000,
    });

    return {
      ok: true,
      message: `บันทึกคะแนนและรีวิวทั้ง 3 ธุรกิจ (${reviews.length} รีวิว) ลง Google Sheet เรียบร้อยแล้ว`,
    };
  } catch (error: unknown) {
    const status =
      (error as { status?: number }).status ??
      (error as { response?: { status?: number } }).response?.status;
    const rawMsg = error instanceof Error ? error.message : String(error);

    if (status === 403 || rawMsg.includes('403') || rawMsg.includes('permission')) {
      // Check if we at least have Viewer access (e.g. user shared as Viewer instead of Editor)
      try {
        const roClient = new JWT({
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        await roClient.request({
          url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=properties.title`,
          timeout: 6000,
        });
        return {
          ok: false,
          message:
            'ชีตนี้แชร์เป็นสิทธิ์อ่านอย่างเดียว (Viewer) กรุณาเปลี่ยนสิทธิ์ของอีเมลระบบเป็น Editor (ผู้แก้ไข) เพื่อให้เว็บเขียนข้อมูลรีวิวลงชีตให้อัตโนมัติค่ะ',
        };
      } catch {
        return {
          ok: false,
          message:
            'ยังไม่ได้แชร์สิทธิ์ Google Sheet ให้อีเมลระบบ กรุณากดปุ่ม Share ในชีตแล้วเพิ่มอีเมลระบบเป็น Editor (ผู้แก้ไข) ค่ะ',
        };
      }
    }
    if (status === 404 || rawMsg.includes('404')) {
      return { ok: false, message: 'ไม่พบไฟล์ Google Sheet จากลิงก์ที่ระบุ' };
    }
    return { ok: false, message: `เขียนข้อมูลลง Google Sheet ไม่สำเร็จ: ${rawMsg.slice(0, 140)}` };
  }
}

export async function syncGbpReviews(): Promise<{
  ok: boolean;
  imported: number;
  perBusiness: Record<string, number>;
  message: string;
}> {
  revalidateTag(PLACES_CACHE_TAG, { expire: 0 });
  const porterInfo = await getGbpSyncInfo();

  if (porterInfo.porterSheetId) {
    const statsRes = await syncPlacesStatsOnly();
    const porterRes = await syncPorterGbpSheet(porterInfo.porterSheetId);
    const parts = [porterRes.message];
    if (!statsRes.ok) parts.push(statsRes.message);

    // Mirror into the web's own export sheet when it is a different file from the Porter source
    if (porterRes.ok && porterInfo.sheetId && porterInfo.sheetId !== porterInfo.porterSheetId) {
      const { locations, reviews } = await loadGbpPageDataFast();
      const expRes = await exportGbpDataToSheet(porterInfo.sheetId, locations, reviews);
      parts.push(expRes.ok ? 'บันทึกลง Google Sheet แล้ว' : expRes.message);
    }

    const combinedMsg = parts.join(' · ');
    await prisma
      .$executeRawUnsafe(
        `UPDATE "GbpSyncConfig"
         SET "lastSyncedAt" = CURRENT_TIMESTAMP,
             "lastSyncOk" = $2,
             "lastSyncMessage" = $1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = 'default';`,
        combinedMsg,
        porterRes.ok
      )
      .catch(() => {});
    return { ...porterRes, message: combinedMsg };
  }

  const directRes = await syncGooglePlacesDirect();
  const info = await getGbpSyncInfo();

  if (info.sheetId && directRes.ok) {
    const { locations, reviews } = await loadGbpPageDataFast();
    const expRes = await exportGbpDataToSheet(info.sheetId, locations, reviews);
    if (expRes.ok) {
      const combinedMsg = `${directRes.message} · บันทึกลง Google Sheet แล้ว`;
      await prisma
        .$executeRawUnsafe(
          `UPDATE "GbpSyncConfig"
           SET "lastSyncedAt" = CURRENT_TIMESTAMP,
               "lastSyncOk" = true,
               "lastSyncMessage" = $1,
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = 'default';`,
          combinedMsg
        )
        .catch(() => {});
      return { ...directRes, message: combinedMsg };
    }
    // Fallback: if user linked a read-only Porter Metrics sheet with existing rows, import from it
    const porterRes = await syncPorterGbpSheet(info.sheetId);
    if (porterRes.ok && porterRes.imported > 0) {
      return porterRes;
    }
    await prisma
      .$executeRawUnsafe(
        `UPDATE "GbpSyncConfig"
         SET "lastSyncedAt" = CURRENT_TIMESTAMP,
             "lastSyncOk" = false,
             "lastSyncMessage" = $1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = 'default';`,
        expRes.message
      )
      .catch(() => {});
    return { ...directRes, ok: false, message: expRes.message };
  }

  return directRes;
}

/** Keeps the linked Google Sheet updated whenever staff add/reply/delete reviews on the web. */
export async function syncLinkedSheetIfConfigured(): Promise<void> {
  const info = await getGbpSyncInfo();
  if (!info.sheetId || info.sheetId === info.porterSheetId) return;
  const { locations, reviews } = await loadGbpPageDataFast();
  // Legacy setup where the export sheet itself is a Porter sheet: never overwrite it
  if (!info.porterSheetId && reviews.some(r => r.source === PORTER_SOURCE)) return;
  await exportGbpDataToSheet(info.sheetId, locations, reviews).catch(() => {});
}

/**
 * Fast read-only loader for GET /api/integrations (<100ms cached, <600ms cold):
 * Combines cached live Google Places data with any DB replies/manual reviews without running DDL or blocking writes.
 */
export async function loadGbpPageDataFast(): Promise<{
  locations: GbpLocationSummary[];
  reviews: GbpReviewItem[];
  syncInfo: GbpSyncInfo;
}> {
  let liveError: string | null = null;
  const [livePlaces, dbReviews, dbLocations, syncInfo] = await Promise.all([
    getCachedGooglePlacesData().catch((err: unknown) => {
      liveError = err instanceof Error ? err.message : String(err);
      return null;
    }),
    withTimeout(
      prisma.$queryRawUnsafe<GbpReviewItem[]>(
        `SELECT "id", "locationId", "reviewerName", "rating", "comment",
                "reviewDate", "replyText", "repliedBy", "source"
         FROM "GbpReview"
         WHERE "id" NOT IN ('rev-1', 'rev-2', 'rev-3')
         ORDER BY "reviewDate" DESC, "createdAt" DESC;`
      ),
      2500,
      []
    ),
    withTimeout(
      prisma.$queryRawUnsafe<GbpLocationSummary[]>(
        `SELECT "id", "name", "businessKey", "address", "owner", "rating",
                "totalReviews", "repliedCount", "lastReviewAt", "mapsUrl"
         FROM "GbpLocation"
         ORDER BY "id" ASC;`
      ),
      2500,
      []
    ),
    getGbpSyncInfo(),
  ]);

  const locMap = new Map(dbLocations.map(l => [l.id, l]));
  const locations: GbpLocationSummary[] = DEFAULT_LOCATIONS.map(def => {
    const dbLoc = locMap.get(def.id);
    const liveStat = livePlaces?.stats?.[def.id];
    const isOldMockup = dbLoc && (dbLoc.totalReviews === 48 || dbLoc.totalReviews === 62 || dbLoc.totalReviews === 115);
    return {
      ...def,
      owner: dbLoc?.owner || def.owner,
      rating: liveStat?.rating ?? (!isOldMockup && dbLoc ? dbLoc.rating : def.rating),
      totalReviews: liveStat?.totalReviews ?? (!isOldMockup && dbLoc ? dbLoc.totalReviews : def.totalReviews),
      repliedCount: !isOldMockup && dbLoc ? dbLoc.repliedCount : 0,
      // In Porter mode the Places "latest" date comes from featured reviews, so trust the DB (Porter) date instead
      lastReviewAt: syncInfo.porterSheetId
        ? dbLoc?.lastReviewAt || ''
        : liveStat?.lastReviewAt || (!isOldMockup && dbLoc?.lastReviewAt ? dbLoc.lastReviewAt : ''),
      mapsUrl: def.mapsUrl,
    };
  });

  // Merge cached live Google Maps reviews + DB reviews (preserving staff replies & manual/sheet entries)
  const mergedReviews: GbpReviewItem[] = [];
  for (const def of DEFAULT_LOCATIONS) {
    const locId = def.id;
    const dbForLoc = dbReviews.filter(r => r.locationId === locId);
    const liveForLoc = livePlaces?.reviewsByLoc?.[locId] || [];

    // Porter mode: newest reviews + owner replies come only from the Porter sheet (plus manual entries);
    // Places "featured" reviews are skipped because they are neither the newest nor carry replies
    if (syncInfo.porterSheetId || dbForLoc.some(r => r.source === PORTER_SOURCE)) {
      mergedReviews.push(
        ...dbForLoc.filter(r => r.source !== 'Google Maps API').slice(0, MAX_REVIEWS_PER_BUSINESS)
      );
      continue;
    }

    const bySig = new Map<string, GbpReviewItem>();
    const byId = new Map<string, GbpReviewItem>();
    for (const d of dbForLoc) {
      bySig.set(`${d.reviewerName}|${d.reviewDate}`, d);
      byId.set(d.id, d);
    }

    const combined: GbpReviewItem[] = [];
    const usedSigs = new Set<string>();

    for (const lv of liveForLoc) {
      const sig = `${lv.reviewerName}|${lv.reviewDate}`;
      const prev = byId.get(lv.id) || bySig.get(sig);
      usedSigs.add(sig);
      combined.push({
        ...lv,
        replyText: prev?.replyText || lv.replyText || '',
        repliedBy: prev?.repliedBy || lv.repliedBy || '',
      });
    }

    for (const d of dbForLoc) {
      const sig = `${d.reviewerName}|${d.reviewDate}`;
      if (!usedSigs.has(sig)) {
        usedSigs.add(sig);
        combined.push(d);
      }
    }

    mergedReviews.push(
      ...combined
        .sort((a, b) => b.reviewDate.localeCompare(a.reviewDate))
        .slice(0, MAX_REVIEWS_PER_BUSINESS)
    );
  }

  const totalCount = mergedReviews.length;
  const hasSheetError = Boolean(syncInfo.sheetId && syncInfo.lastSyncOk === false && syncInfo.lastSyncMessage);
  const sheetSuffix =
    syncInfo.sheetId && syncInfo.lastSyncOk === true ? ' · บันทึกลง Google Sheet อัตโนมัติ' : '';

  // Porter mode reports the real sheet sync result (time + message) instead of the hourly Places cache
  const effectiveSyncInfo: GbpSyncInfo = syncInfo.porterSheetId ? syncInfo : {
    ...syncInfo,
    lastSyncedAt: livePlaces?.fetchedAt || syncInfo.lastSyncedAt || null,
    lastSyncOk: hasSheetError
      ? false
      : livePlaces
      ? true
      : syncInfo.lastSyncOk ?? (liveError ? false : null),
    lastSyncMessage: hasSheetError
      ? syncInfo.lastSyncMessage
      : livePlaces
      ? `ดึงจาก Google Maps สำเร็จ ${totalCount} รีวิว (CAR ${mergedReviews.filter(r => r.locationId === 'loc-car').length}, GFS ${mergedReviews.filter(r => r.locationId === 'loc-gfs').length}, MHL ${mergedReviews.filter(r => r.locationId === 'loc-mhl').length})${sheetSuffix}`
      : syncInfo.lastSyncMessage || (liveError ? `Google Maps API: ${liveError}` : null),
  };

  return {
    locations,
    reviews: mergedReviews,
    syncInfo: effectiveSyncInfo,
  };
}
