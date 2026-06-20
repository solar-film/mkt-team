import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const meetingId = searchParams.get('meetingId')

    const taskWhere: any = {}
    if (meetingId) taskWhere.meetingId = meetingId
    if (memberId && memberId !== 'all') {
      taskWhere.OR = [
        { memberId: memberId },
        { memberId: 'all' }
      ]
    }

    const contentWhere: any = {}
    if (meetingId) contentWhere.meetingId = meetingId
    if (memberId && memberId !== 'all') {
      contentWhere.OR = [
        { memberId: memberId },
        { memberId: 'all' }
      ]
    }

    const ideaWhere: any = { category: { in: ['task', 'content'] } };
    if (memberId && memberId !== 'all') {
      ideaWhere.memberId = { contains: memberId };
    }

    const [tasks, contents, members, kpis, meetings, events, ideas] = await Promise.all([
      prisma.task.findMany({
        where: taskWhere,
        include: {
          member: { select: { id: true, name: true, avatar: true } }
        },
        orderBy: { deadline: 'asc' }
      }),
      prisma.content.findMany({
        where: contentWhere,
        include: {
          member: { select: { id: true, name: true, avatar: true } }
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
      prisma.meeting.findMany({
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
    const finalTasks = [...tasks];
    const finalContents = [...contents];

    ideas.forEach(idea => {
      const assignees = idea.memberId ? idea.memberId.split(',') : [];
      if (assignees.length === 0) return; // Unassigned ideas don't show on board
      
      const mapIdeaStatus = (s: string) => {
        if (!s || s === 'รอดำเนินการ') return 'todo';
        if (s === 'เสร็จแล้ว') return 'done';
        // 'กำลังดำเนินการ', 'รอตรวจ', etc.
        return 'in_progress';
      };

      assignees.forEach(assigneeId => {
        const mem = members.find(m => m.id === assigneeId);
        if (!mem) return;
        
        const boardStatus = mapIdeaStatus(idea.status);

        if (idea.category === 'task') {
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
            memberId: mem.id,
            createdAt: idea.createdAt,
            updatedAt: idea.updatedAt,
            member: { id: mem.id, name: mem.name, avatar: mem.avatar }
          });
        } else if (idea.category === 'content') {
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
            memberId: mem.id,
            createdAt: idea.createdAt,
            updatedAt: idea.updatedAt,
            member: { id: mem.id, name: mem.name, avatar: mem.avatar }
          });
        }
      });
    });

    return NextResponse.json({
      tasks: finalTasks,
      contents: finalContents,
      members,
      kpis,
      meetings,
      events
    });
  } catch (error) {
    console.error('Dashboard API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
