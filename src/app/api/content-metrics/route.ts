import { cachedJsonRead, invalidateWorkspace } from '@/lib/workspace-cache'
import { readJsonBody, RequestBodyError } from '@/lib/request-body'
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { memberAssignmentFilter, serializeAssignments } from '@/lib/assignments';


async function readGET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const company = searchParams.get('company');
    const platform = searchParams.get('platform');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    if ((month && month !== 'all' && (!/^\d+$/.test(month) || +month < 1 || +month > 12)) ||
        (year && year !== 'all' && (!/^\d{4}$/.test(year) || +year < 2000 || +year > 2200))) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
    }
    
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
      select: {
        id: true, title: true, company: true, companies: true, memberId: true, memberIds: true,
        platform: true, publishDate: true, link: true,
        member: { select: { id: true, name: true } },
        metrics: true
      },
      orderBy: { publishDate: 'desc' }
    });

    const serialized = contents.map(serializeAssignments);
    const assignedIds = [...new Set(serialized.flatMap(content => content.memberIds).filter(id => id !== 'all'))];
    const assignedMembers = assignedIds.length ? await prisma.teamMember.findMany({
      where: { id: { in: assignedIds } },
      select: { id: true, name: true }
    }) : [];
    const membersById = new Map(assignedMembers.map(member => [member.id, member]));

    return NextResponse.json({ contents: serialized.map(content => ({
      ...content,
      assignedMembers: content.memberIds.map(id => membersById.get(id)).filter(Boolean)
    })) });
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Error fetching content metrics:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await readJsonBody(request);
    const { contentId, snapshot, metrics, recordedById } = data;
    if (typeof contentId !== 'string' || !contentId || typeof snapshot !== 'string' ||
        !['D+1', 'D+3', 'D+7', 'D+14', 'D+15', 'D+30'].includes(snapshot) ||
        !metrics || typeof metrics !== 'object' || Array.isArray(metrics) ||
        (recordedById != null && typeof recordedById !== 'string')) {
      return NextResponse.json({ error: 'Invalid metric data' }, { status: 400 });
    }
    const integerFields = ['views', 'reach', 'likes', 'comments', 'shares', 'saves', 'follows', 'linkClicks', 'profileVisits', 'messages'];
    const decimalFields = ['avgWatchSec', 'adSpend'];
    const metricData: Record<string, number | string | null> = {};
    for (const [key, value] of Object.entries(metrics)) {
      if (key === 'note' && (value === null || (typeof value === 'string' && value.length <= 10_000))) {
        metricData[key] = value;
        continue;
      }
      if (![...integerFields, ...decimalFields].includes(key) ||
          (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
            (integerFields.includes(key) && (!Number.isInteger(value) || value > 2_147_483_647)))) ||
          (key === 'adSpend' && value === null)) {
        return NextResponse.json({ error: 'Invalid metric field or value' }, { status: 400 });
      }
      metricData[key] = value as number | null;
    }
    
    // Upsert the metric
    const result = await prisma.contentMetric.upsert({
      where: {
        contentId_snapshot: {
          contentId,
          snapshot
        }
      },
      update: {
        ...metricData,
        recordedById,
        recordedAt: new Date(),
        source: 'manual'
      },
      create: {
        contentId,
        snapshot,
        ...metricData,
        recordedById,
        source: 'manual'
      }
    });

    invalidateWorkspace();
    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Error saving content metric:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = ["content-metrics", ...["memberId","company","platform","month","year"].map(name => url.searchParams.get(name) || '')];
  const snapshot = new Request(url);
  return cachedJsonRead(key, () => readGET(snapshot), url.searchParams.get('fresh') === '1');
}
