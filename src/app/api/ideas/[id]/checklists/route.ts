import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ideaNoteId = params.id
    const body = await request.json()
    const { title, assigneeId, deadline } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const checklist = await prisma.ideaChecklist.create({
      data: {
        title,
        assigneeId: assigneeId || null,
        deadline: deadline ? new Date(deadline) : null,
        ideaNoteId
      }
    })

    return NextResponse.json(checklist)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create checklist item' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { id, title, isDone, assigneeId, deadline } = body

    if (!id) {
      return NextResponse.json({ error: 'Checklist ID is required' }, { status: 400 })
    }

    const checklist = await prisma.ideaChecklist.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        isDone: isDone !== undefined ? isDone : undefined,
        assigneeId: assigneeId !== undefined ? assigneeId : undefined,
        deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : undefined
      }
    })

    return NextResponse.json(checklist)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const checklistId = searchParams.get('checklistId')

    if (!checklistId) {
      return NextResponse.json({ error: 'Checklist ID is required' }, { status: 400 })
    }

    await prisma.ideaChecklist.delete({
      where: { id: checklistId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete checklist item' }, { status: 500 })
  }
}
