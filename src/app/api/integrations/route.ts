import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export interface ToolIntegrationItem {
  id: string;
  name: string;
  status: string; // 'ใช้งานอยู่' | 'ไม่ได้ใช้' | 'ทดลองใช้' | 'สำรองข้อมูล'
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
    id: 'line-messaging-api',
    name: 'LINE Messaging API',
    status: 'ใช้งานอยู่',
    description: 'แจ้งเตือนงานใหม่ คอนเทนต์ กิจกรรม และงานใกล้ครบกำหนดเข้ากลุ่ม LINE',
    source: 'เว็บ MKT (Tasks · Content · Cron)',
    destination: 'กลุ่ม LINE ทีมการตลาด (GFS & MHL)',
    syncSchedule: 'ส่งทันทีเมื่อสร้าง/อัปเดตงาน และ Cron แจ้งเตือนทุกวัน 08:00 น.',
    lifespan: 'Long-lived Channel Access Token ใช้ได้ไม่จำกัดเวลา',
    cost: 'ฟรี (แพ็กเกจเริ่มต้น LINE Official Account)',
    usageLimit: 'Push Message ตามโควตารายเดือนของบัญชี LINE OA',
    linkLabel: 'เปิด LINE Developers',
    linkUrl: 'https://developers.line.biz/console/',
    checkedAt: 'ตรวจ 1 พ.ย. 69',
    sortOrder: 2,
  },
  {
    id: 'supabase-postgres',
    name: 'Supabase PostgreSQL',
    status: 'ใช้งานอยู่',
    description: 'ฐานข้อมูลหลักของเว็บ MKT เก็บงาน คอนเทนต์ KPI โน๊ตไอเดีย และสถิติเพจ',
    source: 'Supabase Cloud (PostgreSQL)',
    destination: 'เว็บ MKT (ทุกเมนูในระบบ)',
    syncSchedule: 'เชื่อมต่อแบบ Real-time ตลอดเวลาผ่าน Prisma ORM',
    lifespan: 'ใช้ได้ไม่จำกัดเวลา (Free Tier ต้องมีการเรียกใช้งานอย่างน้อยทุก 7 วัน)',
    cost: 'ฟรี (Free Plan · พื้นที่ฐานข้อมูล 500 MB)',
    usageLimit: 'ใช้งานจริง 11 ตารางหลัก รองรับการบันทึกสถิติรายเดือนและ D+7/15/30',
    linkLabel: 'เปิด Supabase',
    linkUrl: 'https://supabase.com/dashboard',
    checkedAt: 'ตรวจ 1 พ.ย. 69',
    sortOrder: 3,
  },
  {
    id: 'google-sheets-sync',
    name: 'Google Sheets API',
    status: 'สำรองข้อมูล',
    description: 'เชื่อมต่อ Google Sheets ด้วย Service Account สำหรับดึงหรือสำรองข้อมูล KPI',
    source: 'Google Sheets (ตาราง KPI ทีมการตลาด)',
    destination: 'เว็บ MKT (ระบบนำเข้า KPI)',
    syncSchedule: 'ดึงข้อมูลเฉพาะเมื่อกดซิงก์หรือรันคำสั่งนำเข้า',
    lifespan: 'Service Account Key ใช้ได้ไม่จำกัดเวลาจนกว่าจะยกเลิกสิทธิ์',
    cost: 'ฟรี (Google Cloud Free Quota)',
    usageLimit: 'อ่านและแปลงข้อมูลตารางเป้าหมาย KPI รายเดือนเข้าสู่ฐานข้อมูล',
    linkLabel: 'เปิด Google Sheets',
    linkUrl: 'https://docs.google.com/spreadsheets/d/1t0SA9gkJuQjvJbq1iPtAyWPqkX2NeLgtUI4DagU_K0U',
    checkedAt: 'ตรวจ 1 พ.ย. 69',
    sortOrder: 4,
  },
];

let tableEnsured = false;

async function ensureTableAndSeed() {
  if (!tableEnsured) {
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
    tableEnsured = true;
  }

  const countRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "ToolIntegration";`
  );
  const count = Number(countRows?.[0]?.count ?? 0);

  if (count === 0) {
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
}

export async function GET() {
  try {
    await ensureTableAndSeed();
    const items = await prisma.$queryRawUnsafe<ToolIntegrationItem[]>(
      `SELECT "id", "name", "status", "description", "source", "destination",
              "syncSchedule", "lifespan", "cost", "usageLimit", "linkLabel",
              "linkUrl", "checkedAt", "sortOrder"
       FROM "ToolIntegration"
       ORDER BY "sortOrder" ASC, "createdAt" ASC;`
    );
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to load ToolIntegration from DB, returning defaults:', error);
    return NextResponse.json({ items: DEFAULT_INTEGRATIONS, fallback: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTableAndSeed();
    const body = await request.json();
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
    const checkedAt = body.checkedAt || `ตรวจ ${new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}`;
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
    console.error('Error creating ToolIntegration:', error);
    return NextResponse.json({ error: error.message || 'Failed to create item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureTableAndSeed();
    const body = await request.json();
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
    console.error('Error updating ToolIntegration:', error);
    return NextResponse.json({ error: error.message || 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTableAndSeed();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "ToolIntegration" WHERE "id" = $1;`, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting ToolIntegration:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete item' }, { status: 500 });
  }
}
