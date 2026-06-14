import { NextRequest, NextResponse } from 'next/server'
import { initDoc, generateId } from '@/lib/google-sheets'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['Task']
    const membersSheet = doc.sheetsByTitle['TeamMember']
    
    if (!sheet) return NextResponse.json([])

    const rows = await sheet.getRows()
    let tasks = rows.map(row => ({
      id: row.get('id'),
      title: row.get('title'),
      description: row.get('description'),
      status: row.get('status'),
      priority: row.get('priority'),
      startDate: row.get('startDate') || null,
      deadline: row.get('deadline') || null,
      company: row.get('company'),
      memberId: row.get('memberId'),
      link: row.get('link') || '',
      kpiId: row.get('kpiId') || '',
      createdAt: row.get('createdAt'),
    }))

    if (memberId) {
      tasks = tasks.filter(t => t.memberId === memberId)
    }

    if (membersSheet) {
      const memberRows = await membersSheet.getRows()
      tasks.forEach(task => {
        const mRow = memberRows.find(m => m.get('id') === task.memberId)
        if (mRow) {
          (task as any).member = {
            id: mRow.get('id'),
            name: mRow.get('name'),
            role: mRow.get('role'),
            avatar: mRow.get('avatar')
          }
        }
      })
    }

    // Sort by created at descending
    tasks.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, status, priority, startDate, deadline, memberId, company } = body

    if (!title || !memberId) {
      return NextResponse.json({ error: 'Title and memberId are required' }, { status: 400 })
    }

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['Task']
    if (!sheet) return NextResponse.json({ error: 'Sheet Task not found' }, { status: 404 })

    await sheet.loadHeaderRow()
    let newHeaders = [...sheet.headerValues]
    let headerChanged = false
    if (!newHeaders.includes('startDate')) { newHeaders.push('startDate'); headerChanged = true; }
    if (!newHeaders.includes('kpiId')) { newHeaders.push('kpiId'); headerChanged = true; }
    if (!newHeaders.includes('link')) { newHeaders.push('link'); headerChanged = true; }

    if (headerChanged) {
      try { await sheet.resize({ rowCount: sheet.rowCount, columnCount: newHeaders.length }) } catch(e) {}
      await sheet.setHeaderRow(newHeaders)
    }

    let autoKpiId = body.kpiId || ''
    if (!autoKpiId && deadline) {
      const kpiSheet = doc.sheetsByTitle['KPI']
      if (kpiSheet) {
        const kpiRows = await kpiSheet.getRows()
        const dDate = new Date(deadline)
        const kMonth = dDate.getMonth() + 1
        const kYear = dDate.getFullYear()
        const kpiRow = kpiRows.find(r => r.get('memberId') === memberId && parseInt(r.get('month')) === kMonth && parseInt(r.get('year')) === kYear && r.get('name') === 'งานทั่วไป')
        if (kpiRow) {
          autoKpiId = kpiRow.get('id')
        }
      }
    }

    const newTask = {
      id: generateId(),
      title,
      description: description || '',
      status: status || 'todo',
      priority: priority || 'medium',
      company: company || 'GFS',
      startDate: startDate ? new Date(startDate).toISOString() : '',
      deadline: deadline ? new Date(deadline).toISOString() : '',
      memberId,
      kpiId: autoKpiId,
      link: body.link || '',
      createdAt: new Date().toISOString()
    }

    await sheet.addRow(newTask)
    
    try {
      const membersSheet = doc.sheetsByTitle['TeamMember']
      let memberName = 'ทีมงาน'
      if (membersSheet) {
        const mRows = await membersSheet.getRows()
        const mRow = mRows.find(r => r.get('id') === memberId)
        if (mRow) memberName = mRow.get('name') || memberName
      }
      
      const message = `\n📢 [งานใหม่] ${title}\n👤 มอบหมาย: ${memberName}\n⏰ กำหนดส่ง: ${deadline ? new Date(deadline).toLocaleDateString('th-TH') : '-'}`
      const { sendLineNotify } = await import('@/lib/line-notify')
      await sendLineNotify(message)
    } catch (e) {
      console.error('Error sending line notify:', e)
    }

    return NextResponse.json(newTask, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, ...data } = body

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['Task']
    if (!sheet) return NextResponse.json({ error: 'Sheet Task not found' }, { status: 404 })

    await sheet.loadHeaderRow()
    let newHeaders = [...sheet.headerValues]
    let headerChanged = false
    if (!newHeaders.includes('startDate')) { newHeaders.push('startDate'); headerChanged = true; }
    if (!newHeaders.includes('kpiId')) { newHeaders.push('kpiId'); headerChanged = true; }
    if (!newHeaders.includes('link')) { newHeaders.push('link'); headerChanged = true; }

    if (headerChanged) {
      try { await sheet.resize({ rowCount: sheet.rowCount, columnCount: newHeaders.length }) } catch(e) {}
      await sheet.setHeaderRow(newHeaders)
    }

    const rows = await sheet.getRows()
    const row = rows.find(r => r.get('id') === id)
    if (!row) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    const oldStatus = row.get('status')
    const oldKpiId = row.get('kpiId')
    
    const fields = ['title', 'description', 'status', 'priority', 'company', 'memberId', 'kpiId', 'link']
    fields.forEach(f => {
      if (data[f] !== undefined) row.assign({ [f]: data[f] })
    })
    
    if (status !== undefined) row.assign({ status })
    
    if (data.startDate !== undefined) {
      row.assign({ startDate: data.startDate ? new Date(data.startDate).toISOString() : '' })
    }
    
    if (data.deadline !== undefined) {
      row.assign({ deadline: data.deadline ? new Date(data.deadline).toISOString() : '' })
    }

    await row.save()

    const newStatus = status !== undefined ? status : oldStatus;
    const newKpiId = data.kpiId !== undefined ? data.kpiId : oldKpiId;

    const updateKpi = async (kpiId: string, delta: number) => {
      if (!kpiId) return;
      const kpiSheet = doc.sheetsByTitle['KPI']
      if (kpiSheet) {
        const kpiRows = await kpiSheet.getRows()
        const kpiRow = kpiRows.find(r => r.get('id') === kpiId)
        if (kpiRow) {
          let currentVal = parseFloat(kpiRow.get('current')) || 0
          currentVal += delta
          if (currentVal < 0) currentVal = 0
          kpiRow.assign({ current: currentVal.toString() })
          await kpiRow.save()
        }
      }
    };

    if (newStatus === 'done' && oldStatus !== 'done') {
      await updateKpi(newKpiId, 1);
    } else if (oldStatus === 'done' && newStatus !== 'done') {
      await updateKpi(oldKpiId, -1);
    } else if (oldStatus === 'done' && newStatus === 'done' && oldKpiId !== newKpiId) {
      await updateKpi(oldKpiId, -1);
      await updateKpi(newKpiId, 1);
    }

    if (Object.keys(data).length > 0) {
      try {
        const title = data.title || row.get('title')
        const memberId = data.memberId || row.get('memberId')
        const mRows = doc.sheetsByTitle['TeamMember'] ? await doc.sheetsByTitle['TeamMember'].getRows() : []
        const mRow = mRows.find(r => r.get('id') === memberId)
        const memberName = mRow ? mRow.get('name') : 'ไม่ระบุ'
        const dDate = data.deadline !== undefined ? data.deadline : row.get('deadline')
        const message = `\n✏️ [แก้ไขงาน] ${title}\n👤 รับผิดชอบ: ${memberName}\n📅 กำหนดส่ง: ${dDate ? new Date(dDate).toLocaleDateString('th-TH') : '-'}`
        const { sendLineNotify } = await import('@/lib/line-notify')
        await sendLineNotify(message)
      } catch (e) {
        console.error('Error sending line notify:', e)
      }
    }

    return NextResponse.json({ id, ...body })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['Task']
    if (!sheet) return NextResponse.json({ error: 'Sheet Task not found' }, { status: 404 })

    const rows = await sheet.getRows()
    const row = rows.find(r => r.get('id') === id)
    if (row) {
      const kpiId = row.get('kpiId')
      const status = row.get('status')
      await row.delete()

      if (kpiId && status === 'done') {
        const kpiSheet = doc.sheetsByTitle['KPI']
        if (kpiSheet) {
          const kpiRows = await kpiSheet.getRows()
          const kpiRow = kpiRows.find(r => r.get('id') === kpiId)
          if (kpiRow) {
            let currentVal = parseFloat(kpiRow.get('current')) || 0
            currentVal -= 1
            if (currentVal < 0) currentVal = 0
            kpiRow.assign({ current: currentVal.toString() })
            await kpiRow.save()
          }
        }
      }

      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
