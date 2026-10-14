import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeAssignments, AssignmentValidationError } from '@/lib/assignments'
import { saveMeetingActions } from '@/lib/meeting-actions'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const where: any = {}
    if (start && end) {
      where.date = {
        gte: new Date(start),
        lte: new Date(end)
      }
    }

    const meetings = await prisma.meeting.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { time: 'desc' }
      ]
    })

    // Fetch related tasks and contents
    const meetingIds = meetings.map(m => m.id)
    const [tasks, contents] = await Promise.all([
      prisma.task.findMany({
        where: { meetingId: { in: meetingIds } },
        include: { member: { select: { id: true, name: true, role: true, avatar: true } } }
      }),
      prisma.content.findMany({
        where: { meetingId: { in: meetingIds } },
        include: { member: { select: { id: true, name: true, role: true, avatar: true } } }
      })
    ])

    const meetingsWithItems = meetings.map(m => ({
      ...m,
      tasks: tasks.filter(t => t.meetingId === m.id).map(serializeAssignments),
      contents: contents.filter(c => c.meetingId === m.id).map(serializeAssignments)
    }))

    return NextResponse.json(meetingsWithItems)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, date, time, company, status, attendees, agenda, notes, createdBy } = body

    if (!title || !date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 })
    }

    const newMeeting = await prisma.$transaction(async tx => {
      const meeting = await tx.meeting.create({
        data: {
          title,
          date: new Date(date),
          time: time || null,
          company: company || 'GFS',
          status: status || 'upcoming',
          attendees: attendees || null,
          agenda: agenda || null,
          notes: notes || null,
          createdBy: createdBy || null
        }
      })
      await saveMeetingActions(tx, meeting.id, body.items)
      return meeting
    })

    return NextResponse.json({ success: true, meeting: newMeeting })
  } catch (error) {
    if (error instanceof AssignmentValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to add meeting' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, date, time, company, status, attendees, agenda, notes, createdBy } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const updatedMeeting = await prisma.$transaction(async tx => {
      const meeting = await tx.meeting.update({
        where: { id },
        data: {
          title: title !== undefined ? title : undefined,
          date: date !== undefined ? new Date(date) : undefined,
          time: time !== undefined ? time : undefined,
          company: company !== undefined ? company : undefined,
          status: status !== undefined ? status : undefined,
          attendees: attendees !== undefined ? attendees : undefined,
          agenda: agenda !== undefined ? agenda : undefined,
          notes: notes !== undefined ? notes : undefined,
          createdBy: createdBy !== undefined ? createdBy : undefined
        }
      })
      await saveMeetingActions(tx, meeting.id, body.items)
      return meeting
    })

    return NextResponse.json({ success: true, meeting: updatedMeeting })
  } catch (error) {
    if (error instanceof AssignmentValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await prisma.meeting.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 })
  }
}
