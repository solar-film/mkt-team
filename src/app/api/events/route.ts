import { cachedJsonRead, invalidateWorkspace } from '@/lib/workspace-cache'
import { readJsonBody, RequestBodyError } from '@/lib/request-body'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendLineNotify } from '@/lib/line-notify'

export const dynamic = 'force-dynamic'

async function readGET(request: Request) {
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

    const events = await prisma.event.findMany({
      where,
      orderBy: {
        date: 'asc'
      }
    })

    return NextResponse.json(events)
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

  export async function POST(request: NextRequest) {
    try {
      const body = await readJsonBody(request)
      const { title, date, time, type, company, notifyLine } = body
  
      if (!title || !date) {
        return NextResponse.json({ error: 'Title and date are required' }, { status: 400 })
      }
  
      const newEvent = await prisma.event.create({
        data: {
          title,
          date: new Date(date),
          time: time || null,
          type: type || 'event',
          company: company || 'GFS'
        }
      })
  
      if (notifyLine) {
        const dateObj = new Date(date)
        const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('th-TH') : '-'
        const timeStr = time ? `เวลา ${time} น.` : ''
        const message = `\n📢 แจ้งเตือนกิจกรรมใหม่: ${title}\nวันที่: ${dateStr} ${timeStr}`
        await sendLineNotify(message)
      }
  
      invalidateWorkspace();
    return NextResponse.json({ success: true, event: newEvent })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to add event' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonBody(request)
    const { id, title, date, time, type, company } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        date: date !== undefined ? new Date(date) : undefined,
        time: time !== undefined ? time : undefined,
        type: type !== undefined ? type : undefined,
        company: company !== undefined ? company : undefined
      }
    })

    invalidateWorkspace();
    return NextResponse.json({ success: true, event: updatedEvent })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await prisma.event.delete({
      where: { id }
    })

    invalidateWorkspace();
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = ["events", ...["start","end"].map(name => url.searchParams.get(name) || '')];
  const snapshot = new Request(url);
  return cachedJsonRead(key, () => readGET(snapshot), url.searchParams.get('fresh') === '1');
}
