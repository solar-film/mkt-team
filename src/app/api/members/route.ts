import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeRelations = searchParams.get('includeRelations') === 'true'

    const members = await prisma.teamMember.findMany({
      where: { id: { not: 'all' } },
      orderBy: {
        name: 'asc'
      },
      include: includeRelations ? {
        tasks: true,
        kpis: true,
        contents: true
      } : undefined
    })
    return NextResponse.json(members)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch members', 
      details: error?.message || String(error) 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, role, company, avatar, status } = body

    if (!name || !role) {
      return NextResponse.json({ error: 'Name and role are required' }, { status: 400 })
    }

    const newMember = await prisma.teamMember.create({
      data: {
        name,
        role,
        company: company || 'GFS',
        avatar: avatar || null,
        status: status || 'active'
      }
    })

    return NextResponse.json({ success: true, member: newMember })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, role, company, avatar, status } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const updatedMember = await prisma.teamMember.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        role: role !== undefined ? role : undefined,
        company: company !== undefined ? company : undefined,
        avatar: avatar !== undefined ? avatar : undefined,
        status: status !== undefined ? status : undefined
      }
    })

    return NextResponse.json({ success: true, member: updatedMember })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await prisma.teamMember.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 })
  }
}
