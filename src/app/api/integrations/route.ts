import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export interface ToolIntegrationItem {
  id: string;
  name: string;
  status: string;
  description: string;
  source: string;
  destination: string;
  syncSchedule: string;
  lifespan: string;
  cost: string;
  usageLimit: string;
  linkLabel: string;
  linkUrl: string;
  checkedAt: string;
  sortOrder: number;
}

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

const DEFAULT_INTEGRATIONS: ToolIntegrationItem[] = [
  {
    id: 'porter-metrics',
    name: 'Porter Metrics',
    status: 'ไม่ได้ใช้',
    description: 'ตรวจรีวิว Google Business Profile · ยังไม่ส่งเข้าเว็บ MKT',
    source: 'Google Business Profile 1 บัญชี / 3 สถานที่',
    destination: '— (ยังไม่ได้ต่อเข้าเว็บ MKT)',
    syncSchedule: 'ถามผ่าน AI เมื่อต้องการ',
    lifespan: 'ทดลองฟีเจอร์เต็ม 14 วัน แล้วเป็นแพ็กเกจ Free ใช้ได้ไม่จำกัดเวลา',
    cost: 'ฟรี (Free forever) สำหรับ Google Business Profile',
    usageLimit: 'ถามผ่าน AI ย้อนหลังได้ 15 วัน · รายงานทั่วไปย้อนหลังได้ถึง 30 วัน',
    linkLabel: 'เปิด Porter',
    linkUrl: 'https://portermetrics.com/',
    checkedAt: 'ตรวจ 1 พ.ย. 69',
    sortOrder: 1,
  },
  {
    id: 'windsor-ai',
    name: 'Windsor.ai',
    status: 'ใช้งานอยู่',
    description: 'ค่าโฆษณา Facebook · Google และ Reach โพสต์เพจ Facebook',
    source: 'Facebook Ads 5 บัญชี · Google Ads 6 บัญชี · เพจ Facebook 4 เพจ',
    destination: 'หน้า ข้อมูลตลาด · สรุปผลงาน & ประเมิน',
    syncSchedule: 'ทุกวัน 06:00 ค่าโฆษณา (10 วันล่าสุด) · 06:30 โพสต์เพจ (12 วันล่าสุด)',
    lifespan: 'ทดลองใช้ฟรี ถึง ~30 พ.ย. 69',
    cost: 'ฟรีช่วงทดลอง · วางแผนใช้ Basic $19/เดือน (จ่ายรายปี $228)',
    usageLimit: '3 แหล่งข้อมูล / 15 บัญชี–เพจ อยู่ในโควตา Basic (3 แหล่ง)',
    linkLabel: 'เปิด Windsor',
    linkUrl: 'https://onboard.windsor.ai/app/settings/account',
    checkedAt: 'ตรวจ 1 พ.ย. 69',
    sortOrder: 2,
  },
  {
    id: 'make-com',
    name: 'Make.com',
    status: 'ไม่ได้ใช้',
    description: 'ดึง Google Analytics 4 ของเว็บไซต์ · ยังไม่ส่งเข้าเว็บ MKT',
    source: 'GA4 5 Properties (ทดสอบแล้วครบ) · Facebook Messenger → Google Sheets',
    destination: '— (ยังไม่ได้ต่อเข้าเว็บ MKT)',
    syncSchedule: 'ยังไม่ได้ตรวจตารางเวลา',
    lifespan: 'ไม่หมดอายุ · เครดิตรีเซ็ต ~22 พ.ย. 69',
    cost: 'ฟรี 1,000 เครดิต/เดือน · ต้องคุมจำนวนรันไม่ให้เกินโควตา',
    usageLimit: '~12 จาก 1,000 เครดิต (ตรวจ 1 พ.ย. ก่อนทดสอบ GA4)',
    linkLabel: 'เปิด Make',
    linkUrl: 'https://eu1.make.com/',
    checkedAt: 'ตรวจ 1 พ.ย. 69',
    sortOrder: 3,
  },
];

let tablesEnsured = false;

async function ensureTablesAndSeed() {
  if (!tablesEnsured) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ToolIntegration" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ไม่ได้ใช้',
        "description" TEXT NOT NULL DEFAULT '',
        "source" TEXT NOT NULL DEFAULT '',
        "destination" TEXT NOT NULL DEFAULT '',
        "syncSchedule" TEXT NOT NULL DEFAULT '',
        "lifespan" TEXT NOT NULL DEFAULT '',
        "cost" TEXT NOT NULL DEFAULT '',
        "usageLimit" TEXT NOT NULL DEFAULT '',
        "linkLabel" TEXT NOT NULL DEFAULT '',
        "linkUrl" TEXT NOT NULL DEFAULT '',
        "checkedAt" TEXT NOT NULL DEFAULT '',
        "sortOrder" INTEGER NOT NULL DEFAULT 10,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ToolIntegration_pkey" PRIMARY KEY ("id")
      );
    `);

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

  const toolCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "ToolIntegration";`
  );
  if (Number(toolCount?.[0]?.count ?? 0) === 0) {
    for (const item of DEFAULT_INTEGRATIONS) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ToolIntegration" (
          "id", "name", "status", "description", "source", "destination",
          "syncSchedule", "lifespan", "cost", "usageLimit", "linkLabel", "linkUrl",
          "checkedAt", "sortOrder", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
        ON CONFLICT ("id") DO NOTHING;`,
        item.id,
        item.name,
        item.status,
        item.description,
        item.source,
        item.destination,
        item.syncSchedule,
        item.lifespan,
        item.cost,
        item.usageLimit,
        item.linkLabel,
        item.linkUrl,
        item.checkedAt,
        item.sortOrder
      );
    }
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
    const [items, locations, reviews] = await Promise.all([
      prisma.$queryRawUnsafe<ToolIntegrationItem[]>(
        `SELECT "id", "name", "status", "description", "source", "destination",
                "syncSchedule", "lifespan", "cost", "usageLimit", "linkLabel",
                "linkUrl", "checkedAt", "sortOrder"
         FROM "ToolIntegration"
         ORDER BY "sortOrder" ASC, "createdAt" ASC;`
      ),
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
    return NextResponse.json({ items, locations, reviews });
  } catch (error) {
    console.error('Failed to load GBP/Integrations from DB, returning defaults:', error);
    return NextResponse.json({
      items: DEFAULT_INTEGRATIONS,
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

    if (body.kind === 'review') {
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
    }

    const id = body.id || `tool_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const name = (body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const status = body.status || 'ไม่ได้ใช้';
    const description = body.description || '';
    const source = body.source || '';
    const destination = body.destination || '';
    const syncSchedule = body.syncSchedule || '';
    const lifespan = body.lifespan || '';
    const cost = body.cost || '';
    const usageLimit = body.usageLimit || '';
    const linkLabel = body.linkLabel || `เปิด ${name}`;
    const linkUrl = body.linkUrl || '';
    const checkedAt =
      body.checkedAt ||
      `ตรวจ ${new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}`;
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : 50;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "ToolIntegration" (
        "id", "name", "status", "description", "source", "destination",
        "syncSchedule", "lifespan", "cost", "usageLimit", "linkLabel", "linkUrl",
        "checkedAt", "sortOrder", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP);`,
      id,
      name,
      status,
      description,
      source,
      destination,
      syncSchedule,
      lifespan,
      cost,
      usageLimit,
      linkLabel,
      linkUrl,
      checkedAt,
      sortOrder
    );

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Error creating item:', error);
    return NextResponse.json({ error: error.message || 'Failed to create item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureTablesAndSeed();
    const body = await request.json();

    if (body.kind === 'review-reply') {
      const { id, replyText, repliedBy } = body;
      if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
      await prisma.$executeRawUnsafe(
        `UPDATE "GbpReview"
         SET "replyText" = $2,
             "repliedBy" = $3
         WHERE "id" = $1;`,
        id,
        (replyText || '').trim(),
        (repliedBy || '').trim()
      );
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

    const {
      id,
      name,
      status,
      description,
      source,
      destination,
      syncSchedule,
      lifespan,
      cost,
      usageLimit,
      linkLabel,
      linkUrl,
      checkedAt,
    } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'ID and name are required' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "ToolIntegration"
       SET "name" = $2,
           "status" = $3,
           "description" = $4,
           "source" = $5,
           "destination" = $6,
           "syncSchedule" = $7,
           "lifespan" = $8,
           "cost" = $9,
           "usageLimit" = $10,
           "linkLabel" = $11,
           "linkUrl" = $12,
           "checkedAt" = $13,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1;`,
      id,
      name,
      status || 'ไม่ได้ใช้',
      description || '',
      source || '',
      destination || '',
      syncSchedule || '',
      lifespan || '',
      cost || '',
      usageLimit || '',
      linkLabel || '',
      linkUrl || '',
      checkedAt || ''
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating item:', error);
    return NextResponse.json({ error: error.message || 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTablesAndSeed();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const kind = searchParams.get('kind');
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (kind === 'review') {
      await prisma.$executeRawUnsafe(`DELETE FROM "GbpReview" WHERE "id" = $1;`, id);
      return NextResponse.json({ success: true });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "ToolIntegration" WHERE "id" = $1;`, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete item' }, { status: 500 });
  }
}
