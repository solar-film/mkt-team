import { NextRequest, NextResponse } from 'next/server'
import { initDoc, generateId } from '@/lib/google-sheets'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const doc = await initDoc()
    const membersSheet = doc.sheetsByTitle['TeamMember']
    const tasksSheet = doc.sheetsByTitle['Task']
    const kpisSheet = doc.sheetsByTitle['KPI']
    const contentsSheet = doc.sheetsByTitle['Content']

    if (!membersSheet) return NextResponse.json([])

    const rows = await membersSheet.getRows()
    const members = rows.map(row => ({
      id: row.get('id'),
      name: row.get('name'),
      role: row.get('role'),
      company: row.get('company'),
      avatar: row.get('avatar'),
      status: row.get('status') || 'active',
      createdAt: row.get('createdAt') || new Date().toISOString(),
      tasks: [] as any[],
      kpis: [] as any[],
      contents: [] as any[],
      _count: { tasks: 0, kpis: 0, contents: 0 }
    }))

    const { searchParams } = new URL(request.url)
    const includeRelations = searchParams.get('includeRelations') === 'true'

    if (includeRelations) {
      if (tasksSheet) {
        const taskRows = await tasksSheet.getRows()
        taskRows.forEach(row => {
          const member = members.find(m => m.id === row.get('memberId'))
          if (member) {
            member.tasks.push({ 
              id: row.get('id'), 
              title: row.get('title'),
              status: row.get('status'),
              priority: row.get('priority'),
              company: row.get('company'),
              deadline: row.get('deadline'),
              link: row.get('link'),
              kpiId: row.get('kpiId'),
              createdAt: row.get('createdAt')
            })
            member._count.tasks++
          }
        })
      }

      if (kpisSheet) {
        await kpisSheet.loadHeaderRow()
        const headers = kpisSheet.headerValues;
        if (!headers.includes('id')) {
          const newHeaders = [...headers, 'id'];
          try { await kpisSheet.resize({ rowCount: kpisSheet.rowCount, columnCount: newHeaders.length }); } catch(e) {}
          await kpisSheet.setHeaderRow(newHeaders);
        }

        const kpiRows = await kpisSheet.getRows()
        for (const row of kpiRows) {
          let rowId = row.get('id');
          if (!rowId) {
            rowId = generateId();
            row.assign({ id: rowId });
            await row.save();
          }

          const member = members.find(m => m.id === row.get('memberId'))
          if (member) {
            member.kpis.push({
              id: rowId,
              name: row.get('name'),
              target: parseFloat(row.get('target')),
              current: parseFloat(row.get('current') || '0'),
              unit: row.get('unit'),
              month: parseInt(row.get('month') || '6', 10),
              year: parseInt(row.get('year') || '2026', 10)
            })
            member._count.kpis++
          }
        }
      }

      if (contentsSheet) {
        const contentRows = await contentsSheet.getRows()
        contentRows.forEach(row => {
          const member = members.find(m => m.id === row.get('memberId'))
          if (member) {
            member.contents.push({ 
              id: row.get('id'), 
              title: row.get('title'),
              status: row.get('status'),
              publishDate: row.get('publishDate'),
              platform: row.get('platform'),
              company: row.get('company'),
              link: row.get('link'),
              kpiId: row.get('kpiId'),
              createdAt: row.get('createdAt')
            })
            member._count.contents++
          }
        })
      }
    }

    return NextResponse.json(members)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['TeamMember']
    if (!sheet) return NextResponse.json({ error: 'Sheet TeamMember not found' }, { status: 404 })

    await sheet.loadHeaderRow()
    let newHeaders = [...sheet.headerValues]
    let headerChanged = false
    if (!newHeaders.includes('status')) { newHeaders.push('status'); headerChanged = true; }

    if (headerChanged) {
      try { await sheet.resize({ rowCount: sheet.rowCount, columnCount: newHeaders.length }) } catch(e) {}
      await sheet.setHeaderRow(newHeaders)
    }

    const newMember = {
      id: generateId(),
      name: body.name,
      role: body.role,
      company: body.company || 'GFS',
      avatar: body.avatar || '',
      status: 'active',
      createdAt: new Date().toISOString()
    }
    
    await sheet.addRow(newMember)
    return NextResponse.json(newMember, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, role, company, avatar } = body
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['TeamMember']
    if (!sheet) return NextResponse.json({ error: 'Sheet TeamMember not found' }, { status: 404 })

    await sheet.loadHeaderRow()
    let newHeaders = [...sheet.headerValues]
    let headerChanged = false
    if (!newHeaders.includes('status')) { newHeaders.push('status'); headerChanged = true; }

    if (headerChanged) {
      try { await sheet.resize({ rowCount: sheet.rowCount, columnCount: newHeaders.length }) } catch(e) {}
      await sheet.setHeaderRow(newHeaders)
    }

    const rows = await sheet.getRows()
    const row = rows.find(r => r.get('id') === id)
    if (!row) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    if (name) row.assign({ name })
    if (role) row.assign({ role })
    if (company) row.assign({ company })
    if (avatar !== undefined) row.assign({ avatar })
    if (body.status !== undefined) row.assign({ status: body.status })
    
    await row.save()
    
    return NextResponse.json({ id, name: row.get('name'), role: row.get('role'), company: row.get('company'), avatar: row.get('avatar') })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['TeamMember']
    if (!sheet) return NextResponse.json({ error: 'Sheet TeamMember not found' }, { status: 404 })

    const rows = await sheet.getRows()
    const row = rows.find(r => r.get('id') === id)
    if (row) {
      await row.delete()
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 })
  }
}
