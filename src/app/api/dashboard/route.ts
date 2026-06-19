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

    const [tasks, contents, members, kpis, meetings, events] = await Promise.all([
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
      })
    ]);

    return NextResponse.json({
      tasks,
      contents,
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
