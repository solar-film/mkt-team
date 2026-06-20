import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(ideas)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch idea notes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, memberId, recommendedFor, company } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const idea = await prisma.ideaNote.create({
      data: {
        title,
        description,
        memberId: memberId || null,
        recommendedFor: recommendedFor || null,
        company: company || null
      }
    })

    return NextResponse.json(idea)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create idea note' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, description, memberId, recommendedFor, company } = body

    if (!id || !title) {
      return NextResponse.json({ error: 'ID and title are required' }, { status: 400 })
    }

    const idea = await prisma.ideaNote.update({
      where: { id },
      data: {
        title,
        description,
        memberId: memberId || null,
        recommendedFor: recommendedFor || null,
        company: company || null
      }
    })

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
