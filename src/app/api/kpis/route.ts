import { NextRequest, NextResponse } from 'next/server'
import { initDoc, generateId } from '@/lib/google-sheets'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['KPI']
    const membersSheet = doc.sheetsByTitle['TeamMember']
    
    if (!sheet) return NextResponse.json([])

    const rows = await sheet.getRows()
    let kpis = rows.map(row => ({
      id: row.get('id'),
      name: row.get('name'),
      target: parseFloat(row.get('target') || '0'),
      current: parseFloat(row.get('current') || '0'),
      unit: row.get('unit'),
      month: parseInt(row.get('month') || '0', 10),
      year: parseInt(row.get('year') || '0', 10),
      company: row.get('company'),
      memberId: row.get('memberId'),
      createdAt: row.get('createdAt')
    }))

    if (memberId) kpis = kpis.filter(k => k.memberId === memberId)
    if (month) kpis = kpis.filter(k => k.month === parseInt(month, 10))
    if (year) kpis = kpis.filter(k => k.year === parseInt(year, 10))

    if (membersSheet) {
      const memberRows = await membersSheet.getRows()
      kpis.forEach(kpi => {
        const mRow = memberRows.find(m => m.get('id') === kpi.memberId)
        if (mRow) {
          (kpi as any).member = {
            id: mRow.get('id'),
            name: mRow.get('name'),
            role: mRow.get('role'),
            avatar: mRow.get('avatar')
          }
        }
      })
    }

    // Sort by created at descending
    kpis.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

    return NextResponse.json(kpis)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch KPIs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, target, current, unit, month, year, memberId, company } = body

    if (!name || !memberId) {
      return NextResponse.json({ error: 'Name and memberId are required' }, { status: 400 })
    }

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['KPI']
    if (!sheet) return NextResponse.json({ error: 'Sheet KPI not found' }, { status: 404 })

    await sheet.loadHeaderRow()
    let newHeaders = [...sheet.headerValues]
    let headerChanged = false
    if (!newHeaders.includes('month')) { newHeaders.push('month'); headerChanged = true; }
    if (!newHeaders.includes('year')) { newHeaders.push('year'); headerChanged = true; }

    if (headerChanged) {
      try { await sheet.resize({ rowCount: sheet.rowCount, columnCount: newHeaders.length }) } catch(e) {}
      await sheet.setHeaderRow(newHeaders)
    }

    const newKpi = {
      id: generateId(),
      name,
      target: (target || 0).toString(),
      current: (current || 0).toString(),
      unit: unit || '',
      month: (month || new Date().getMonth() + 1).toString(),
      year: (year || new Date().getFullYear()).toString(),
      company: company || 'GFS',
      memberId: memberId || '',
      createdAt: new Date().toISOString()
    }

    await sheet.addRow(newKpi)
    
    // Return parsed numbers for the frontend
    return NextResponse.json({
      ...newKpi,
      target: parseFloat(newKpi.target),
      current: parseFloat(newKpi.current),
      month: parseInt(newKpi.month, 10),
      year: parseInt(newKpi.year, 10)
    }, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create KPI' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['KPI']
    if (!sheet) return NextResponse.json({ error: 'Sheet KPI not found' }, { status: 404 })

    const rows = await sheet.getRows()
    const row = rows.find(r => r.get('id') === id)
    if (!row) return NextResponse.json({ error: 'KPI not found' }, { status: 404 })

    const stringFields = ['name', 'unit', 'company', 'memberId']
    stringFields.forEach(f => {
      if (data[f] !== undefined) row.assign({ [f]: data[f] })
    })

    const numberFields = ['target', 'current', 'month', 'year']
    numberFields.forEach(f => {
      if (data[f] !== undefined) row.assign({ [f]: data[f].toString() })
    })

    await row.save()
    return NextResponse.json({ id, ...data })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update KPI' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['KPI']
    if (!sheet) return NextResponse.json({ error: 'Sheet KPI not found' }, { status: 404 })

    const rows = await sheet.getRows()
    const row = rows.find(r => r.get('id') === id)
    if (row) {
      await row.delete()
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'KPI not found' }, { status: 404 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete KPI' }, { status: 500 })
  }
}
