import { cachedJsonRead } from '@/lib/workspace-cache'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeAssignments, memberAssignmentFilter } from '@/lib/assignments'

export const dynamic = 'force-dynamic'

async function readGET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const meetingId = searchParams.get('meetingId')

    const taskWhere: any = {}
    if (meetingId) taskWhere.meetingId = meetingId
    if (memberId && memberId !== 'all') {
      Object.assign(taskWhere, memberAssignmentFilter(memberId))
    }

    const contentWhere: any = {}
    if (meetingId) contentWhere.meetingId = meetingId
    if (memberId && memberId !== 'all') {
      Object.assign(contentWhere, memberAssignmentFilter(memberId))
    }

    const ideaWhere: any = {};
    if (memberId && memberId !== 'all') {
      ideaWhere.memberId = { contains: memberId };
    }

    const [tasks, contents, members, kpis, meetings, events, ideas] = await Promise.all([
      prisma.task.findMany({
        where: taskWhere,
        include: {
          member: { select: { id: true, name: true } }
        },
        orderBy: { deadline: 'asc' }
      }),
      prisma.content.findMany({
        where: contentWhere,
        include: {
          member: { select: { id: true, name: true } }
        },
        orderBy: { publishDate: 'asc' }
      }),
      prisma.teamMember.findMany({
        where: { id: { not: 'all' } },
        orderBy: { name: 'asc' }
      }),
      prisma.kPI.findMany({
        orderBy: { month: 'desc' }
      }),
      // Dashboard consumers only show meeting titles; agenda/notes are loaded on the meetings page.
      prisma.meeting.findMany({
        select: { id: true, title: true, date: true, time: true, company: true, status: true, attendees: true, createdBy: true, createdAt: true, updatedAt: true },
        orderBy: { date: 'desc' }
      }),
      prisma.event.findMany({
        orderBy: { date: 'asc' }
      }),
      prisma.ideaNote.findMany({
        where: ideaWhere
      })
    ]);

    // Map Ideas to Tasks/Contents
    const finalTasks: any[] = [...tasks];
    const finalContents: any[] = [...contents];

    ideas.forEach(idea => {
      const assignees = idea.memberId ? idea.memberId.split(',') : [];
      if (assignees.length === 0) return; // Unassigned ideas don't show on board
      
      const mapIdeaStatus = (s: string) => {
        if (!s || s === 'รอดำเนินการ' || s === 'pending') return 'todo';
        if (s === 'เสร็จแล้ว' || s === 'done' || s === 'approved') return 'done';
        return 'in_progress';
      };

      const boardStatus = mapIdeaStatus(idea.status);
      const isMultiple = assignees.length > 1;
      const mem = members.find(m => m.id === assignees[0]);
      const memberObj = isMultiple ? null : (mem ? { id: mem.id, name: mem.name } : null);

      if (idea.category === 'content') {
        finalContents.push({
          id: `idea_${idea.id}`,
          title: `💡 ${idea.title}`,
          description: idea.description,
          type: 'Idea',
          platform: idea.platform || 'General',
          status: boardStatus,
          publishDate: idea.deadline,
          company: idea.company || 'GFS',
          link: null,
          kpiId: idea.kpiId,
          meetingId: null,
          memberId: idea.memberId,
          createdAt: idea.createdAt,
          updatedAt: idea.updatedAt,
          member: memberObj
        });
      } else {
        // category 'task' or 'idea' goes to finalTasks
        finalTasks.push({
          id: `idea_${idea.id}`,
          title: `💡 ${idea.title}`,
          description: idea.description,
          status: boardStatus,
          priority: idea.priority,
          startDate: null,
          deadline: idea.deadline,
          company: idea.company || 'GFS',
          link: null,
          kpiId: idea.kpiId,
          meetingId: null,
          memberId: idea.memberId,
          createdAt: idea.createdAt,
          updatedAt: idea.updatedAt,
          member: memberObj
        });
      }
    });

    return NextResponse.json({
      tasks: finalTasks.map(serializeAssignments),
      contents: finalContents.map(serializeAssignments),
      members,
      kpis,
      meetings,
      events
    }, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Dashboard API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = ["dashboard", ...["memberId","meetingId"].map(name => url.searchParams.get(name) || '')];
  const snapshot = new Request(url);
  return cachedJsonRead(key, () => readGET(snapshot), url.searchParams.get('fresh') === '1');
}
