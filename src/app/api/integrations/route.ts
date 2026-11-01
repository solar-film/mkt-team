import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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

const DEFAULT_REVIEWS: GbpReviewItem[] = [
  {
    id: 'rev-1',
    locationId: 'loc-car',
    reviewerName: 'คุณณัฐพงศ์ ส.',
    rating: 5,
    comment: 'ติดฟิล์มรถยนต์ 3M Crystalline งานเนี๊ยบมาก ห้องปลอดฝุ่น พนักงานให้คำแนะนำดีมากครับ',
    reviewDate: '2026-11-01',
    replyText: 'ขอบคุณคุณณัฐพงศ์มากครับที่ไว้วางใจ MHL CARFILM ยินดีให้บริการเสมอครับ',
    repliedBy: 'นน (NON)',
    source: 'Porter Metrics / GBP',
  },
  {
    id: 'rev-2',
    locationId: 'loc-mhl',
    reviewerName: 'คุณพิมพ์ชนก ว.',
    rating: 5,
    comment: 'ทีมช่างมโหฬารฟิล์มเข้าติดตั้งฟิล์มคอนโดตรงเวลา เก็บงานสะอาด ลดความร้อนได้ชัดเจนค่ะ',
    reviewDate: '2026-10-31',
    replyText: 'ขอบพระคุณคุณพิมพ์ชนกค่ะ หากต้องการคำแนะนำเพิ่มเติมทัก LINE @MHL1 ได้ตลอดเลยนะคะ',
    repliedBy: 'เพลง (PLENG)',
    source: 'Porter Metrics / GBP',
  },
  {
    id: 'rev-3',
    locationId: 'loc-gfs',
    reviewerName: 'คุณกิตติศักดิ์ ช่างกระจกอลูมิเนียม',
    rating: 5,
    comment: 'สั่งฟิล์มอาคาร 3M ยกม้วนกับ GOODFILM ของแท้ ส่งไว ราคาช่าง คุยง่ายครับ',
    reviewDate: '2026-10-30',
    replyText: '',
    repliedBy: '',
    source: 'Porter Metrics / GBP',
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

  const revCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "GbpReview";`
  );
  if (Number(revCount?.[0]?.count ?? 0) === 0) {
    for (const rev of DEFAULT_REVIEWS) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "GbpReview" (
          "id", "locationId", "reviewerName", "rating", "comment",
          "reviewDate", "replyText", "repliedBy", "source"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT ("id") DO NOTHING;`,
        rev.id,
        rev.locationId,
        rev.reviewerName,
        rev.rating,
        rev.comment,
        rev.reviewDate,
        rev.replyText,
        rev.repliedBy,
        rev.source
      );
    }
  }
}

export async function GET() {
  try {
    await ensureTablesAndSeed();
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
         FROM "GbpReview"
         ORDER BY "reviewDate" DESC, "createdAt" DESC;`
      ),
    ]);
    return NextResponse.json({ locations, reviews });
  } catch (error) {
    console.error('Failed to load GBP data from DB, returning defaults:', error);
    return NextResponse.json({
      locations: DEFAULT_LOCATIONS,
      reviews: DEFAULT_REVIEWS,
      fallback: true,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTablesAndSeed();
    const body = await request.json();

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
