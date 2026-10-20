import { cachedJsonRead, invalidateWorkspace } from '@/lib/workspace-cache'
import { readJsonBody, RequestBodyError } from '@/lib/request-body'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendLineNotify } from '@/lib/line-notify'
import { assignmentData } from '@/lib/assignment-storage'
import { notificationMembers, notificationMemberLabel } from '@/lib/notification-assignees'
import { serializeAssignments, memberAssignmentFilter, AssignmentValidationError } from '@/lib/assignments'

export const dynamic = 'force-dynamic'

async function readGET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const meetingId = searchParams.get('meetingId')

    const where: any = {}
    if (meetingId) where.meetingId = meetingId
    if (memberId && memberId !== 'all') {
      Object.assign(where, memberAssignmentFilter(memberId))
    }

    const contents = await prisma.content.findMany({
      where,
      include: {
        member: {
          select: { id: true, name: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(contents.map(serializeAssignments))
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof AssignmentValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request)
    const { title, description, type, platform, status, publishDate, memberId, company, link, kpiId, meetingId, notifyLine } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const assignments = await assignmentData(body, prisma, true)
    const newContent = await prisma.content.create({
      data: {
        title,
        description: description || null,
        type: type || '',
        platform: platform || '',
        status: status || 'draft',
        publishDate: publishDate ? new Date(publishDate) : null,
        ...assignments,
        memberId: assignments.memberId!,
        link: link || null,
        kpiId: kpiId || null,
        meetingId: meetingId || null
      },
      include: {
        member: { select: { id: true, name: true } }
      }
    })

    if (notifyLine) {
      const memberName = notificationMemberLabel(newContent, await notificationMembers([newContent], prisma))
      const dateStr = publishDate ? new Date(publishDate).toLocaleDateString('th-TH') : '-'
      const message = `\n📢 คอนเทนต์ใหม่: ${title}\nรายละเอียด: ${description || '-'}\nช่องทาง: ${platform || '-'}\nผู้รับผิดชอบ: ${memberName}\nวันที่เผยแพร่: ${dateStr}`
      await sendLineNotify(message)
    }

    invalidateWorkspace();
    return NextResponse.json({ success: true, content: serializeAssignments(newContent) })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof AssignmentValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to add content' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonBody(request)
    const { id, title, description, type, platform, status, publishDate, memberId, company, link, kpiId, meetingId, notifyLine } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const assignments = await assignmentData(body, prisma)
    const updatedContent = await prisma.content.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        description: description !== undefined ? description : undefined,
        type: type !== undefined ? type : undefined,
        platform: platform !== undefined ? platform : undefined,
        status: status !== undefined ? status : undefined,
        publishDate: publishDate !== undefined ? (publishDate ? new Date(publishDate) : null) : undefined,
        ...assignments,
        link: link !== undefined ? link : undefined,
        kpiId: kpiId !== undefined ? kpiId : undefined,
        meetingId: meetingId !== undefined ? meetingId : undefined
      },
      include: {
        member: { select: { id: true, name: true } }
      }
    })

    if (notifyLine) {
      const memberName = notificationMemberLabel(updatedContent, await notificationMembers([updatedContent], prisma))
      let statStr = 'Draft'
      if (status === 'published') statStr = '✅ Published'
      if (status === 'scheduled') statStr = '🗓️ Scheduled'
      const descStr = description !== undefined ? (description || '-') : (updatedContent.description || '-')
      const message = `\nอัปเดตคอนเทนต์: ${title || updatedContent.title}\nรายละเอียด: ${descStr}\nสถานะ: ${statStr}\nผู้รับผิดชอบ: ${memberName}`
      await sendLineNotify(message)
    }

    invalidateWorkspace();
    return NextResponse.json({ success: true, content: serializeAssignments(updatedContent) })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof AssignmentValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await prisma.content.delete({
      where: { id }
    })

    invalidateWorkspace();
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof AssignmentValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = ["content", ...["memberId","meetingId"].map(name => url.searchParams.get(name) || '')];
  const snapshot = new Request(url);
  return cachedJsonRead(key, () => readGET(snapshot), url.searchParams.get('fresh') === '1');
}
