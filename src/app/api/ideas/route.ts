import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendLineNotify } from '@/lib/line-notify'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    const where: any = {}
    if (memberId) {
      where.memberId = memberId
    }

    const ideas = await prisma.ideaNote.findMany({
      where,
      include: {
        checklists: { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
        comments: { orderBy: { createdAt: 'asc' } }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(ideas)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, memberId, recommendedFor, company, status, priority, deadline, category, platform, kpiId } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const idea = await prisma.ideaNote.create({
      data: {
        title,
        description,
        memberId: memberId || null,
        recommendedFor: recommendedFor || null,
        company: company || null,
        status: status || 'pending',
        priority: priority || 'normal',
        deadline: deadline ? new Date(deadline) : null,
        category: category || 'idea',
        platform: platform || null,
        kpiId: kpiId || null
      }
    })

    if (body.notifyLine) {
      let memberName = 'ทีมงาน'
      if (idea.memberId) {
        const member = await prisma.teamMember.findUnique({ where: { id: idea.memberId } })
        if (member) memberName = member.name
      }
      
      let pStr = 'ปกติ'
      if (priority === 'high' || priority === 'ด่วน') pStr = 'ด่วน'
      const message = `\n💡 โน๊ตงานใหม่: ${title}\nรายละเอียด: ${description || '-'}\nผู้รับผิดชอบ: ${memberName}\nความสำคัญ: ${pStr}`
      await sendLineNotify(message)
    }

    return NextResponse.json(idea)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create idea note' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, description, memberId, recommendedFor, company, status, priority, deadline, category, platform, kpiId } = body

    if (!id || !title) {
      return NextResponse.json({ error: 'ID and title are required' }, { status: 400 })
    }

    const idea = await prisma.ideaNote.update({
      where: { id },
      data: {
        title,
        description,
        memberId: memberId !== undefined ? (memberId || null) : undefined,
        recommendedFor: recommendedFor !== undefined ? (recommendedFor || null) : undefined,
        company: company !== undefined ? (company || null) : undefined,
        status: status || undefined,
        priority: priority || undefined,
        deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : undefined,
        category: category !== undefined ? (category || 'idea') : undefined,
        platform: platform !== undefined ? (platform || null) : undefined,
        kpiId: kpiId !== undefined ? (kpiId || null) : undefined
      }
    })

    if (body.notifyLine) {
      let memberName = 'ทีมงาน'
      if (idea.memberId) {
        const member = await prisma.teamMember.findUnique({ where: { id: idea.memberId } })
        if (member) memberName = member.name
      }
      
      let pStr = 'ปกติ'
      if (priority === 'high' || priority === 'ด่วน') pStr = 'ด่วน'
      const message = `\n💡 อัปเดตโน๊ตงาน: ${title}\nรายละเอียด: ${description || '-'}\nผู้รับผิดชอบ: ${memberName}\nความสำคัญ: ${pStr}`
      await sendLineNotify(message)
    }

    return NextResponse.json(idea)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update idea note' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    await prisma.ideaNote.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete idea note' }, { status: 500 })
  }
}
