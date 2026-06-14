import { NextRequest, NextResponse } from 'next/server'
import { initDoc, generateId } from '@/lib/google-sheets'

export const dynamic = 'force-dynamic'

async function getOrCreateSheet(doc: any) {
  let sheet = doc.sheetsByTitle['Event'];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: 'Event',
      headerValues: ['id', 'title', 'date', 'time', 'type', 'createdAt']
    });
  }
  return sheet;
}

export async function GET(request: NextRequest) {
  try {
    const doc = await initDoc()
    const sheet = await getOrCreateSheet(doc);
    
    const rows = await sheet.getRows()
    let events = rows.map((row: any) => ({
      id: row.get('id'),
      title: row.get('title'),
      date: row.get('date'),
      time: row.get('time') || '',
      type: row.get('type') || 'event',
      createdAt: row.get('createdAt'),
    }))

    return NextResponse.json(events)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, date, time, type } = body

    if (!title || !date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 })
    }

    const doc = await initDoc()
    const sheet = await getOrCreateSheet(doc);

    const newEvent = {
      id: generateId(),
      title,
      date,
      time: time || '',
      type: type || 'event',
      createdAt: new Date().toISOString()
    }

    await sheet.addRow(newEvent)
    
    return NextResponse.json(newEvent, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, date, time, type } = body

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const doc = await initDoc()
    const sheet = await getOrCreateSheet(doc);

    const rows = await sheet.getRows()
    const row = rows.find((r: any) => r.get('id') === id)
    if (!row) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    if (title !== undefined) row.set('title', title)
    if (date !== undefined) row.set('date', date)
    if (time !== undefined) row.set('time', time)
    if (type !== undefined) row.set('type', type)

    await row.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const doc = await initDoc()
    const sheet = await getOrCreateSheet(doc);

    const rows = await sheet.getRows()
    const row = rows.find((r: any) => r.get('id') === id)
    if (!row) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    await row.delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}
