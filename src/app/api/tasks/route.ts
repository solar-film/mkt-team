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

    const tasks = await prisma.task.findMany({
      where,
      include: {
        member: {
          select: {
            id: true,
            name: true,
            role: true,
            avatar: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, status, priority, startDate, deadline, memberId, company, meetingId, link, kpiId, notifyLine } = body

    if (!title || !memberId) {
      return NextResponse.json({ error: 'Title and memberId are required' }, { status: 400 })
    }

    const newTask = await prisma.task.create({
      data: {
        title,
        description: description || null,
        status: status || 'todo',
        priority: priority || 'medium',
        startDate: startDate ? new Date(startDate) : null,
        deadline: deadline ? new Date(deadline) : null,
        company: company || 'GFS',
        memberId,
        meetingId: meetingId || null,
        link: link || null,
        kpiId: kpiId || null
      },
      include: {
        member: { select: { id: true, name: true, avatar: true } }
      }
    })

    if (notifyLine) {
      const memberName = newTask.member?.name || 'ทีมงาน'
      const dateStr = deadline ? new Date(deadline).toLocaleDateString('th-TH') : '-'
      let pStr = 'ปานกลาง'
      if (priority === 'high') pStr = 'ด่วนมาก'
      if (priority === 'low') pStr = 'ปกติ'
      const message = `\n📋 งานใหม่: ${title}\nผู้รับผิดชอบ: ${memberName}\nกำหนดส่ง: ${dateStr}\nความสำคัญ: ${pStr}`
      await sendLineNotify(message)
    }

    return NextResponse.json({ success: true, task: newTask })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to add task' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, description, status, priority, startDate, deadline, memberId, company, meetingId, link, kpiId, notifyLine } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        description: description !== undefined ? description : undefined,
        status: status !== undefined ? status : undefined,
        priority: priority !== undefined ? priority : undefined,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : undefined,
        company: company !== undefined ? company : undefined,
        memberId: memberId !== undefined ? memberId : undefined,
        meetingId: meetingId !== undefined ? meetingId : undefined,
        link: link !== undefined ? link : undefined,
        kpiId: kpiId !== undefined ? kpiId : undefined
      },
      include: {
        member: { select: { id: true, name: true, avatar: true } }
      }
    })

    if (notifyLine) {
      const memberName = updatedTask.member?.name || 'ทีมงาน'
      let statStr = 'รอดำเนินการ'
      if (status === 'done') statStr = '✅ เสร็จสิ้น'
      if (status === 'in_progress') statStr = '🔄 กำลังทำ'
      const message = `\nอัปเดตงาน: ${title || updatedTask.title}\nสถานะ: ${statStr}\nผู้รับผิดชอบ: ${memberName}`
      await sendLineNotify(message)
    }

    return NextResponse.json({ success: true, task: updatedTask })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await prisma.task.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
