import { cachedJsonRead, invalidateWorkspace } from '@/lib/workspace-cache'
import { readJsonBody, RequestBodyError } from '@/lib/request-body'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function readGET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const where: any = {}
    if (memberId && memberId !== 'all') where.memberId = memberId
    if (month) where.month = parseInt(month)
    if (year) where.year = parseInt(year)

    const kpis = await prisma.kPI.findMany({
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

    return NextResponse.json(kpis)
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch KPIs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request)
    const { name, target, unit, month, year, memberId, company } = body

    if (!name || !memberId) {
      return NextResponse.json({ error: 'Name and memberId are required' }, { status: 400 })
    }

    const newKpi = await prisma.kPI.create({
      data: {
        name,
        target: parseFloat(target) || 0,
        current: 0,
        unit: unit || 'งาน',
        month: parseInt(month) || new Date().getMonth() + 1,
        year: parseInt(year) || new Date().getFullYear(),
        company: company || 'GFS',
        memberId
      },
      include: {
        member: { select: { id: true, name: true, avatar: true } }
      }
    })

    invalidateWorkspace();
    return NextResponse.json({ success: true, kpi: newKpi })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to add KPI' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonBody(request)
    const { id, name, target, current, unit, month, year, memberId, company } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const updatedKpi = await prisma.kPI.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        target: target !== undefined ? parseFloat(target) : undefined,
        current: current !== undefined ? parseFloat(current) : undefined,
        unit: unit !== undefined ? unit : undefined,
        month: month !== undefined ? parseInt(month) : undefined,
        year: year !== undefined ? parseInt(year) : undefined,
        company: company !== undefined ? company : undefined,
        memberId: memberId !== undefined ? memberId : undefined
      },
      include: {
        member: { select: { id: true, name: true, avatar: true } }
      }
    })

    invalidateWorkspace();
    return NextResponse.json({ success: true, kpi: updatedKpi })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update KPI' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await prisma.kPI.delete({
      where: { id }
    })

    invalidateWorkspace();
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete KPI' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = ["kpis", ...["memberId","month","year"].map(name => url.searchParams.get(name) || '')];
  const snapshot = new Request(url);
  return cachedJsonRead(key, () => readGET(snapshot), url.searchParams.get('fresh') === '1');
}
