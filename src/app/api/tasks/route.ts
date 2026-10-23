import { cachedJsonRead, invalidateWorkspace } from '@/lib/workspace-cache'
import { readJsonBody, RequestBodyError } from '@/lib/request-body'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendLineNotify } from '@/lib/line-notify'
import { assignmentData } from '@/lib/assignment-storage'
import { notificationMembers, notificationMemberLabel } from '@/lib/notification-assignees'
import { serializeAssignments, memberAssignmentFilter, AssignmentValidationError } from '@/lib/assignments'
import { joinKpiIds } from '@/lib/task-kpi'
import { COMPLETION_LINK_MESSAGE, blocksCompletion } from '@/lib/completion-link'

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

    const tasks = await prisma.task.findMany({
      where,
      include: {
        member: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(tasks.map(serializeAssignments))
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof AssignmentValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request)
    const { title, description, status, priority, startDate, deadline, memberId, company, meetingId, link, kpiId, notifyLine } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (blocksCompletion('task', null, { status: status || 'todo', kpiId: joinKpiIds(kpiId), link })) {
      return NextResponse.json({ error: COMPLETION_LINK_MESSAGE }, { status: 400 })
    }

    const assignments = await assignmentData(body, prisma, true)
    // A double click or retry sends the same save twice within seconds: return the first record instead of creating a copy.
    const repeated = await prisma.task.findFirst({
      where: {
        title,
        memberId: assignments.memberId!,
        deadline: deadline ? new Date(deadline) : null,
        createdAt: { gte: new Date(Date.now() - 10_000) }
      },
      include: { member: { select: { id: true, name: true } } }
    })
    if (repeated) return NextResponse.json({ success: true, duplicate: true, task: serializeAssignments(repeated) })
    const newTask = await prisma.task.create({
      data: {
        title,
        description: description || null,
        status: status || 'todo',
        priority: priority || 'medium',
        startDate: startDate ? new Date(startDate) : null,
        deadline: deadline ? new Date(deadline) : null,
        ...assignments,
        memberId: assignments.memberId!,
        meetingId: meetingId || null,
        link: link || null,
        kpiId: joinKpiIds(kpiId)
      },
      include: {
        member: { select: { id: true, name: true } }
      }
    })

    if (notifyLine) {
      const memberName = notificationMemberLabel(newTask, await notificationMembers([newTask], prisma))
      const dateStr = deadline ? new Date(deadline).toLocaleDateString('th-TH') : '-'
      let pStr = 'ปานกลาง'
      if (priority === 'high') pStr = 'ด่วนมาก'
      if (priority === 'low') pStr = 'ปกติ'
      const message = `\n📋 งานใหม่: ${title}\nรายละเอียด: ${description || '-'}\nผู้รับผิดชอบ: ${memberName}\nกำหนดส่ง: ${dateStr}\nความสำคัญ: ${pStr}`
      await sendLineNotify(message)
    }

    invalidateWorkspace();
    return NextResponse.json({ success: true, task: serializeAssignments(newTask) })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof AssignmentValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to add task' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonBody(request)
    const { id, title, description, status, priority, startDate, deadline, memberId, company, meetingId, link, kpiId, notifyLine } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    if (status !== undefined || kpiId !== undefined || link !== undefined) {
      const before = await prisma.task.findUnique({ where: { id }, select: { status: true, kpiId: true, link: true } })
      if (before) {
        const after = {
          status: status !== undefined ? status : before.status,
          kpiId: kpiId !== undefined ? joinKpiIds(kpiId) : before.kpiId,
          link: link !== undefined ? link : before.link,
        }
        if (blocksCompletion('task', before, after)) return NextResponse.json({ error: COMPLETION_LINK_MESSAGE }, { status: 400 })
      }
    }

    const assignments = await assignmentData(body, prisma)
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        description: description !== undefined ? description : undefined,
        status: status !== undefined ? status : undefined,
        priority: priority !== undefined ? priority : undefined,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : undefined,
        ...assignments,
        meetingId: meetingId !== undefined ? meetingId : undefined,
        link: link !== undefined ? link : undefined,
        kpiId: kpiId !== undefined ? joinKpiIds(kpiId) : undefined
      },
      include: {
        member: { select: { id: true, name: true } }
      }
    })

    if (notifyLine) {
      const memberName = notificationMemberLabel(updatedTask, await notificationMembers([updatedTask], prisma))
      let statStr = 'รอดำเนินการ'
      if (status === 'done') statStr = '✅ เสร็จสิ้น'
      if (status === 'in_progress') statStr = '🔄 กำลังทำ'
      const descStr = description !== undefined ? (description || '-') : (updatedTask.description || '-')
      const message = `\nอัปเดตงาน: ${title || updatedTask.title}\nรายละเอียด: ${descStr}\nสถานะ: ${statStr}\nผู้รับผิดชอบ: ${memberName}`
      await sendLineNotify(message)
    }

    invalidateWorkspace();
    return NextResponse.json({ success: true, task: serializeAssignments(updatedTask) })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof AssignmentValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
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

    invalidateWorkspace();
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof AssignmentValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = ["tasks", ...["memberId","meetingId"].map(name => url.searchParams.get(name) || '')];
  const snapshot = new Request(url);
  return cachedJsonRead(key, () => readGET(snapshot), url.searchParams.get('fresh') === '1');
}
