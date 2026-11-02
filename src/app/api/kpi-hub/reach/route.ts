import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { isContentDone } from '@/lib/dashboard-items';
import { monthQueryRange } from '@/lib/kpi-summary';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export interface ReachPost {
  id: string;
  title: string;
  platform: string;
  promotion: string | null;
  publishDate: string;
  reach7: number;
  source: string;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const memberId = params.get('memberId');
  const year = Number(params.get('year'));
  const month = Number(params.get('month'));
  if (!memberId || !Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'พารามิเตอร์ไม่ถูกต้อง' }, { status: 400, headers });
  }

  const range = monthQueryRange(year, month);
  try {
    const contents = await prisma.content.findMany({
      where: {
        publishDate: range,
        OR: [{ memberId }, { memberIds: { has: memberId } }],
      },
      select: {
        id: true,
        title: true,
        platform: true,
        promotion: true,
        publishDate: true,
        status: true,
        metrics: {
          where: { snapshot: 'D+7' },
          select: { reach: true, source: true },
          take: 1,
        },
      },
      orderBy: { publishDate: 'desc' },
    });

    const posts: ReachPost[] = contents
      .filter(c => isContentDone(c.status) && c.publishDate && c.metrics[0]?.reach != null)
      .map(c => ({
        id: c.id,
        title: c.title,
        platform: c.platform,
        promotion: c.promotion,
        publishDate: bangkokDateKey(c.publishDate!),
        reach7: c.metrics[0].reach!,
        source: c.metrics[0].source,
      }))
      .sort((a, b) => b.reach7 - a.reach7);

    return NextResponse.json(posts, { headers });
  } catch (error) {
    console.error('Reach detail failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'โหลดไม่สำเร็จ' }, { status: 503, headers });
  }
}
