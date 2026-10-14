import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { memberAssignmentFilter, serializeAssignments } from '@/lib/assignments';

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
    
    const assignmentFilters = [];
    if (memberId && memberId !== 'all') assignmentFilters.push(memberAssignmentFilter(memberId));
    if (company && company !== 'all') assignmentFilters.push({
      OR: [{ company }, { companies: { has: company } }]
    });
    if (assignmentFilters.length) whereClause.AND = assignmentFilters;
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

    const serialized = contents.map(serializeAssignments);
    const assignedIds = [...new Set(serialized.flatMap(content => content.memberIds).filter(id => id !== 'all'))];
    const assignedMembers = assignedIds.length ? await prisma.teamMember.findMany({
      where: { id: { in: assignedIds } },
      select: { id: true, name: true, avatar: true }
    }) : [];
    const membersById = new Map(assignedMembers.map(member => [member.id, member]));

    return NextResponse.json({ contents: serialized.map(content => ({
      ...content,
      assignedMembers: content.memberIds.map(id => membersById.get(id)).filter(Boolean)
    })) });
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
