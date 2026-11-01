import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MAX_REVIEWS_PER_BUSINESS = 10;

export interface GbpLocationSummary {
  id: string;
  name: string;
  businessKey: string;
  address: string;
  owner: string;
  rating: number;
  totalReviews: number;
  repliedCount: number;
  lastReviewAt: string;
  mapsUrl: string;
}

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

const DEFAULT_LOCATIONS: GbpLocationSummary[] = [
  {
    id: 'loc-gfs',
    name: 'GOODFILM สำนักงานใหญ่ (GFS B2B/B2C)',
    businessKey: 'GFS',
    address: '914/10-11 ถ.ลาซาล แขวงบางนา เขตบางนา กรุงเทพฯ 10260',
    owner: 'แต้ว + จ๋าย',
    rating: 4.9,
    totalReviews: 48,
    repliedCount: 45,
    lastReviewAt: '2026-10-30',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=GOODFILM+ลาซาล+บางนา',
  },
  {
    id: 'loc-mhl',
    name: 'มโหฬารฟิล์ม สำนักงานใหญ่ (MHL อาคาร)',
    businessKey: 'MHL',
    address: '924 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260',
    owner: 'เพลง',
    rating: 4.8,
    totalReviews: 62,
    repliedCount: 58,
    lastReviewAt: '2026-10-31',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=มโหฬารฟิล์ม+ลาซาล',
  },
  {
    id: 'loc-car',
    name: 'MHL CARFILM ศูนย์ติดฟิล์มรถยนต์ (บางนา-ลาซาล)',
    businessKey: 'CAR',
    address: '924 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260 (MRT ศรีลาซาล)',
    owner: 'นน',
    rating: 4.9,
    totalReviews: 115,
    repliedCount: 112,
    lastReviewAt: '2026-11-01',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=MHL+CARFILM+ลาซาล',
  },
];

let tablesEnsured = false;

async function ensureTablesAndSeed() {
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
  }
}

function mapBusinessToLocationId(raw: string): string {
  const s = (raw || '').trim().toUpperCase();
  if (s.includes('CAR') || s.includes('รถ')) return 'loc-car';
  if (s.includes('MHL') || s.includes('มโหฬาร')) return 'loc-mhl';
  return 'loc-gfs';
}

const gbpSheetConfigured = () =>
  Boolean(
    process.env.GBP_REVIEWS_SHEET_ID?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY
  );

async function syncFromPorterSheet(): Promise<{ imported: number }> {
  const sheetId = process.env.GBP_REVIEWS_SHEET_ID!.trim();
  const client = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const res = await client.request<{ values?: unknown[][] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/A1:G500`,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return { imported: 0 };

  // Expected columns: Business/Location | Date (YYYY-MM-DD) | Reviewer | Rating (1-5) | Comment | Reply | RepliedBy
  const grouped: Record<string, GbpReviewItem[]> = { 'loc-gfs': [], 'loc-mhl': [], 'loc-car': [] };
  for (const row of rows.slice(1)) {
    const locId = mapBusinessToLocationId(String(row[0] ?? ''));
    const reviewDate = String(row[1] ?? '').trim().slice(0, 10) || new Date().toISOString().slice(0, 10);
    const reviewerName = String(row[2] ?? '').trim() || 'ลูกค้า Google Maps';
    const rating = Math.min(5, Math.max(1, Number(row[3]) || 5));
    const comment = String(row[4] ?? '').trim();
    const replyText = String(row[5] ?? '').trim();
    const repliedBy = String(row[6] ?? '').trim();
    if (!comment && !reviewerName) continue;

    grouped[locId].push({
      id: `sheet_${locId}_${grouped[locId].length + 1}_${reviewDate}`,
      locationId: locId,
      reviewerName,
      rating,
      comment,
      reviewDate,
      replyText,
      repliedBy,
      source: 'Porter Metrics Sheet',
    });
  }

  let imported = 0;
  for (const [locId, list] of Object.entries(grouped)) {
    const top10 = list
      .sort((a, b) => b.reviewDate.localeCompare(a.reviewDate))
      .slice(0, MAX_REVIEWS_PER_BUSINESS);
    if (top10.length === 0) continue;

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
      imported++;
    }
  }
  return { imported };
}

export async function GET() {
  try {
    await ensureTablesAndSeed();
    // Pull up to 10 latest reviews per business using ROW_NUMBER() OVER (PARTITION BY "locationId")
    const [locations, reviews] = await Promise.all([
      prisma.$queryRawUnsafe<GbpLocationSummary[]>(
        `SELECT "id", "name", "businessKey", "address", "owner", "rating",
                "totalReviews", "repliedCount", "lastReviewAt", "mapsUrl"
         FROM "GbpLocation"
         ORDER BY "id" ASC;`
      ),
      prisma.$queryRawUnsafe<GbpReviewItem[]>(
        `SELECT "id", "locationId", "reviewerName", "rating", "comment",
                "reviewDate", "replyText", "repliedBy", "source"
         FROM (
           SELECT *,
                  ROW_NUMBER() OVER (
                    PARTITION BY "locationId"
                    ORDER BY "reviewDate" DESC, "createdAt" DESC
                  ) AS rn
           FROM "GbpReview"
         ) ranked
         WHERE rn <= ${MAX_REVIEWS_PER_BUSINESS}
         ORDER BY "locationId" ASC, "reviewDate" DESC, "createdAt" DESC;`
      ),
    ]);

    return NextResponse.json({
      locations,
      reviews,
      maxPerBusiness: MAX_REVIEWS_PER_BUSINESS,
      sheetConfigured: gbpSheetConfigured(),
    });
  } catch (error) {
    console.error('Failed to load GBP data from DB, returning defaults:', error);
    return NextResponse.json({
      locations: DEFAULT_LOCATIONS,
      reviews: [],
      maxPerBusiness: MAX_REVIEWS_PER_BUSINESS,
      sheetConfigured: gbpSheetConfigured(),
      fallback: true,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTablesAndSeed();
    const body = await request.json();

    if (body.kind === 'sync-sheet') {
      if (!gbpSheetConfigured()) {
        return NextResponse.json(
          {
            error:
              'ยังไม่ได้เชื่อมต่อ GBP_REVIEWS_SHEET_ID ในระบบ (ต้องผูก Porter Metrics เข้ากับ Google Sheets ก่อน)',
          },
          { status: 400 }
        );
      }
      const { imported } = await syncFromPorterSheet();
      return NextResponse.json({ success: true, imported });
    }

    if (body.kind === 'bulk-import' && Array.isArray(body.reviews)) {
      const locationId = body.locationId || 'loc-car';
      const incoming = body.reviews.slice(0, MAX_REVIEWS_PER_BUSINESS);
      if (body.replaceExisting) {
        await prisma.$executeRawUnsafe(`DELETE FROM "GbpReview" WHERE "locationId" = $1;`, locationId);
      }
      let added = 0;
      for (const item of incoming) {
        const id = `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const reviewerName = String(item.reviewerName || '').trim() || 'ลูกค้า Google Maps';
        const rating = Math.min(5, Math.max(1, Number(item.rating) || 5));
        const comment = String(item.comment || '').trim();
        const reviewDate = String(item.reviewDate || '').trim().slice(0, 10) || new Date().toISOString().slice(0, 10);
        const replyText = String(item.replyText || '').trim();
        const repliedBy = String(item.repliedBy || '').trim();
        await prisma.$executeRawUnsafe(
          `INSERT INTO "GbpReview" (
            "id", "locationId", "reviewerName", "rating", "comment",
            "reviewDate", "replyText", "repliedBy", "source"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Porter Metrics / GBP');`,
          id,
          locationId,
          reviewerName,
          rating,
          comment,
          reviewDate,
          replyText,
          repliedBy
        );
        added++;
      }
      return NextResponse.json({ success: true, added });
    }

    const id = `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const locationId = body.locationId || 'loc-car';
    const reviewerName = (body.reviewerName || '').trim() || 'ลูกค้า Google Maps';
    const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
    const comment = (body.comment || '').trim();
    const reviewDate = body.reviewDate || new Date().toISOString().slice(0, 10);
    const replyText = (body.replyText || '').trim();
    const repliedBy = (body.repliedBy || '').trim();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "GbpReview" (
        "id", "locationId", "reviewerName", "rating", "comment",
        "reviewDate", "replyText", "repliedBy", "source"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Porter Metrics / GBP');`,
      id,
      locationId,
      reviewerName,
      rating,
      comment,
      reviewDate,
      replyText,
      repliedBy
    );

    await prisma.$executeRawUnsafe(
      `UPDATE "GbpLocation"
       SET "totalReviews" = "totalReviews" + 1,
           "repliedCount" = "repliedCount" + $2,
           "lastReviewAt" = GREATEST("lastReviewAt", $3),
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1;`,
      locationId,
      replyText ? 1 : 0,
      reviewDate
    );

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Error creating GBP review:', error);
    return NextResponse.json({ error: error.message || 'Failed to create review' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureTablesAndSeed();
    const body = await request.json();

    if (body.kind === 'review-reply') {
      const { id, replyText, repliedBy } = body;
      if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

      const existing = await prisma.$queryRawUnsafe<{ locationId: string; replyText: string }[]>(
        `SELECT "locationId", "replyText" FROM "GbpReview" WHERE "id" = $1 LIMIT 1;`,
        id
      );
      const prevHadReply = Boolean(existing?.[0]?.replyText?.trim());
      const nextReply = (replyText || '').trim();
      const nextHasReply = Boolean(nextReply);

      await prisma.$executeRawUnsafe(
        `UPDATE "GbpReview"
         SET "replyText" = $2,
             "repliedBy" = $3
         WHERE "id" = $1;`,
        id,
        nextReply,
        (repliedBy || '').trim()
      );

      if (existing?.[0]?.locationId && prevHadReply !== nextHasReply) {
        const delta = nextHasReply ? 1 : -1;
        await prisma.$executeRawUnsafe(
          `UPDATE "GbpLocation"
           SET "repliedCount" = GREATEST(0, "repliedCount" + $2),
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $1;`,
          existing[0].locationId,
          delta
        );
      }

      return NextResponse.json({ success: true });
    }

    if (body.kind === 'location') {
      const { id, rating, totalReviews, repliedCount, lastReviewAt } = body;
      if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
      await prisma.$executeRawUnsafe(
        `UPDATE "GbpLocation"
         SET "rating" = $2,
             "totalReviews" = $3,
             "repliedCount" = $4,
             "lastReviewAt" = $5,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $1;`,
        id,
        Number(rating) || 5.0,
        Number(totalReviews) || 0,
        Number(repliedCount) || 0,
        lastReviewAt || ''
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid update kind' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating GBP item:', error);
    return NextResponse.json({ error: error.message || 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTablesAndSeed();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "GbpReview" WHERE "id" = $1;`, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting GBP review:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete review' }, { status: 500 });
  }
}
