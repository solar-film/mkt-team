import { NextRequest, NextResponse } from 'next/server'
import { initDoc, generateId } from '@/lib/google-sheets'

export const dynamic = 'force-dynamic'

async function getOrCreateSheet(doc: any) {
  let sheet = doc.sheetsByTitle['Meeting'];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: 'Meeting',
      headerValues: ['id', 'title', 'date', 'time', 'attendees', 'agenda', 'notes', 'createdBy', 'createdAt']
    });
  }
  return sheet;
}

export async function GET(request: NextRequest) {
  try {
    const doc = await initDoc()
    const sheet = await getOrCreateSheet(doc);
    const membersSheet = doc.sheetsByTitle['TeamMember'];
    
    const rows = await sheet.getRows()
    let meetings = rows.map((row: any) => ({
      id: row.get('id'),
      title: row.get('title'),
      date: row.get('date'),
      time: row.get('time') || '',
      attendees: row.get('attendees') || '',
      agenda: row.get('agenda') || '',
      notes: row.get('notes') || '',
      createdBy: row.get('createdBy') || '',
      createdAt: row.get('createdAt'),
    }))

    if (membersSheet) {
      const memberRows = await membersSheet.getRows()
      meetings.forEach((meeting: any) => {
        if (meeting.attendees) {
          const attendeeIds = meeting.attendees.split(',').filter(Boolean)
          const names = attendeeIds.map((id: string) => {
            const mRow = memberRows.find((m: any) => m.get('id') === id)
            return mRow ? mRow.get('name') : id
          })
          meeting.attendeeNames = names
        } else {
          meeting.attendeeNames = []
        }
      })
    }

    // Sort by date descending, then time descending
    meetings.sort((a: any, b: any) => {
      const dateA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const dateB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      return dateB - dateA;
    });

    return NextResponse.json(meetings)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, date, time, attendees, agenda, notes, createdBy } = body

    if (!title || !date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 })
    }

    const doc = await initDoc()
    const sheet = await getOrCreateSheet(doc);

    const newMeeting = {
      id: generateId(),
      title,
      date,
      time: time || '',
      attendees: attendees || '',
      agenda: agenda || '',
      notes: notes || '',
      createdBy: createdBy || '',
      createdAt: new Date().toISOString()
    }

    await sheet.addRow(newMeeting)
    
    return NextResponse.json(newMeeting, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, date, time, attendees, agenda, notes } = body

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const doc = await initDoc()
    const sheet = await getOrCreateSheet(doc);

    const rows = await sheet.getRows()
    const row = rows.find((r: any) => r.get('id') === id)
    if (!row) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

    const fields = ['title', 'date', 'time', 'attendees', 'agenda', 'notes'];
    fields.forEach(f => {
      if (body[f] !== undefined) row.set(f, body[f])
    })

    await row.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 })
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
    if (!row) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

    await row.delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 })
  }
}
