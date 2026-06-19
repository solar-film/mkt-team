import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendLineNotify } from '@/lib/line-notify'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const meetingId = searchParams.get('meetingId')

    const where: any = {}
    if (meetingId) where.meetingId = meetingId
    if (memberId && memberId !== 'all') {
      where.OR = [
        { memberId: memberId },
        { memberId: 'all' }
      ]
    }

    const contents = await prisma.content.findMany({
      where,
      include: {
        member: {
          select: { id: true, name: true, avatar: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(contents)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, type, platform, status, publishDate, memberId, company, link, kpiId, meetingId, notifyLine } = body

    if (!title || !memberId) {
      return NextResponse.json({ error: 'Title and memberId are required' }, { status: 400 })
    }

    const newContent = await prisma.content.create({
      data: {
        title,
        description: description || null,
        type: type || '',
        platform: platform || '',
        status: status || 'draft',
        publishDate: publishDate ? new Date(publishDate) : null,
        company: company || 'GFS',
        memberId,
        link: link || null,
        kpiId: kpiId || null,
        meetingId: meetingId || null
      },
      include: {
        member: { select: { id: true, name: true, avatar: true } }
      }
    })

    if (notifyLine) {
      const memberName = newContent.member?.name || 'ทีมงาน'
      const dateStr = publishDate ? new Date(publishDate).toLocaleDateString('th-TH') : '-'
      const message = `\n📢 คอนเทนต์ใหม่: ${title}\nช่องทาง: ${platform || '-'}\nผู้รับผิดชอบ: ${memberName}\nวันที่เผยแพร่: ${dateStr}`
      await sendLineNotify(message)
    }

    return NextResponse.json({ success: true, content: newContent })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to add content' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, description, type, platform, status, publishDate, memberId, company, link, kpiId, meetingId, notifyLine } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const updatedContent = await prisma.content.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        description: description !== undefined ? description : undefined,
        type: type !== undefined ? type : undefined,
        platform: platform !== undefined ? platform : undefined,
        status: status !== undefined ? status : undefined,
        publishDate: publishDate !== undefined ? (publishDate ? new Date(publishDate) : null) : undefined,
        company: company !== undefined ? company : undefined,
        memberId: memberId !== undefined ? memberId : undefined,
        link: link !== undefined ? link : undefined,
        kpiId: kpiId !== undefined ? kpiId : undefined,
        meetingId: meetingId !== undefined ? meetingId : undefined
      },
      include: {
        member: { select: { id: true, name: true, avatar: true } }
      }
    })

    if (notifyLine) {
      const memberName = updatedContent.member?.name || 'ทีมงาน'
      let statStr = 'Draft'
      if (status === 'published') statStr = '✅ Published'
      if (status === 'scheduled') statStr = '🗓️ Scheduled'
      const message = `\nอัปเดตคอนเทนต์: ${title || updatedContent.title}\nสถานะ: ${statStr}\nผู้รับผิดชอบ: ${memberName}`
      await sendLineNotify(message)
    }

    return NextResponse.json({ success: true, content: updatedContent })
  } catch (error) {
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 })
  }
}
