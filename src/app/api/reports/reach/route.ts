import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export interface ReportReach {
  reach7: number;
  source: string;
}

/** Reach D+7 ของทุกคอนเทนต์ที่มีค่าแล้ว สำหรับคอลัมน์ Reach @7 วันในหน้ารายงานรวม */
export async function GET() {
  try {
    const rows = await prisma.contentMetric.findMany({
      where: { snapshot: 'D+7', reach: { not: null } },
      select: { contentId: true, reach: true, source: true, recordedAt: true },
      orderBy: { recordedAt: 'desc' },
    });
    const byContent: Record<string, ReportReach> = {};
    for (const row of rows) {
      // ถ้ามีหลายแถว ใช้แถวที่บันทึกล่าสุด
      if (!byContent[row.contentId]) byContent[row.contentId] = { reach7: row.reach!, source: row.source };
    }
    return NextResponse.json(byContent, { headers });
  } catch (error) {
    console.error('Report reach failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'โหลดไม่สำเร็จ' }, { status: 503, headers });
  }
}
