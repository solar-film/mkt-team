import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const company = searchParams.get('company');
    const platform = searchParams.get('platform');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    
    let whereClause: any = {};
    
    if (memberId && memberId !== 'all') whereClause.memberId = memberId;
    if (company && company !== 'all') whereClause.company = company;
    if (platform && platform !== 'all') {
      whereClause.platform = { contains: platform, mode: 'insensitive' };
    }
    
    if (month && year && month !== 'all' && year !== 'all') {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 1);
      whereClause.publishDate = {
        gte: startDate,
        lt: endDate
      };
    } else if (year && year !== 'all') {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year) + 1, 0, 1);
      whereClause.publishDate = {
        gte: startDate,
        lt: endDate
      };
    }

    const contents = await prisma.content.findMany({
      where: whereClause,
      include: {
        member: true,
        metrics: true
      },
      orderBy: { publishDate: 'desc' },
      take: 200 // reasonable limit
    });

    return NextResponse.json({ contents });
  } catch (error: any) {
    console.error('Error fetching content metrics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { contentId, snapshot, metrics, recordedById } = data;
    
    // Upsert the metric
    const result = await prisma.contentMetric.upsert({
      where: {
        contentId_snapshot: {
          contentId,
          snapshot
        }
      },
      update: {
        ...metrics,
        recordedById,
        recordedAt: new Date(),
        source: 'manual'
      },
      create: {
        contentId,
        snapshot,
        ...metrics,
        recordedById,
        source: 'manual'
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error saving content metric:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
