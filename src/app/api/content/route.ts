import { NextRequest, NextResponse } from 'next/server'
import { initDoc, generateId } from '@/lib/google-sheets'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const meetingId = searchParams.get('meetingId')
    const type = searchParams.get('type')
    const platform = searchParams.get('platform')
    const status = searchParams.get('status')
    const company = searchParams.get('company')

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['Content']
    const membersSheet = doc.sheetsByTitle['TeamMember']
    
    if (!sheet) return NextResponse.json([])

    const rows = await sheet.getRows()
    let contents = rows.map(row => ({
      id: row.get('id'),
      title: row.get('title'),
      type: row.get('type'),
      platform: row.get('platform'),
      status: row.get('status'),
      company: row.get('company'),
      publishDate: row.get('publishDate') || null,
      memberId: row.get('memberId'),
      link: row.get('link') || '',
      kpiId: row.get('kpiId') || '',
      description: row.get('description') || null,
      meetingId: row.get('meetingId') || '',
      createdAt: row.get('createdAt')
    }))

    if (memberId) contents = contents.filter(c => c.memberId === memberId || c.memberId === 'all')
    if (meetingId) contents = contents.filter(c => c.meetingId === meetingId)
    if (type) contents = contents.filter(c => c.type === type)
    if (platform) contents = contents.filter(c => c.platform === platform)
    if (status) contents = contents.filter(c => c.status === status)
    if (company) contents = contents.filter(c => c.company === company)

    if (membersSheet) {
      const memberRows = await membersSheet.getRows()
      contents.forEach(content => {
        const mRow = memberRows.find(m => m.get('id') === content.memberId)
        if (mRow) {
          (content as any).member = {
            id: mRow.get('id'),
            name: mRow.get('name'),
            role: mRow.get('role'),
            avatar: mRow.get('avatar')
          }
        }
      })
    }

    // Sort by created at descending
    contents.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

    return NextResponse.json(contents)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, type, platform, status, publishDate, memberId, company, meetingId } = body

    if (!title || !memberId) {
      return NextResponse.json({ error: 'Title and memberId are required' }, { status: 400 })
    }

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['Content']
    if (!sheet) return NextResponse.json({ error: 'Sheet Content not found' }, { status: 404 })

    await sheet.loadHeaderRow()
    let newHeaders = [...sheet.headerValues]
    let headerChanged = false
    if (!newHeaders.includes('kpiId')) { newHeaders.push('kpiId'); headerChanged = true; }
    if (!newHeaders.includes('link')) { newHeaders.push('link'); headerChanged = true; }
    if (!newHeaders.includes('description')) { newHeaders.push('description'); headerChanged = true; }
    if (!newHeaders.includes('meetingId')) { newHeaders.push('meetingId'); headerChanged = true; }

    if (headerChanged) {
      try { await sheet.resize({ rowCount: sheet.rowCount, columnCount: newHeaders.length }) } catch(e) {}
      await sheet.setHeaderRow(newHeaders)
    }

    const mRows = doc.sheetsByTitle['TeamMember'] ? await doc.sheetsByTitle['TeamMember'].getRows() : []
    const mRow = mRows.find(r => r.get('id') === memberId)
    const memberName = mRow ? mRow.get('name') : 'ไม่ระบุ'

    const newContent = {
      id: generateId(),
      title,
      type: type || 'post',
      platform: platform || 'Facebook',
      status: status || 'draft',
      publishDate: publishDate || '',
      memberId,
      company: company || 'GFS',
      kpiId: body.kpiId || '',
      link: body.link || '',
      description: body.description || '',
      meetingId: meetingId || '',
      createdAt: new Date().toISOString()
    }

    await sheet.addRow(newContent)

    if (body.notifyLine) {
      try {
        let message = `\n🆕 [เพิ่มคอนเทนต์] ${title}\n👤 รับผิดชอบ: ${memberName}\n📅 เผยแพร่: ${publishDate ? new Date(publishDate).toLocaleDateString('th-TH') : '-'}`
        if (body.description) message += `\n📝 รายละเอียด: ${body.description}`
        if (platform) message += `\n📱 แพลตฟอร์ม: ${platform}`
        const { sendLineNotify } = await import('@/lib/line-notify')
        await sendLineNotify(message)
      } catch (e) {
        console.error('Error sending line notify:', e)
      }
    }

    return NextResponse.json(newContent, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create content' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, ...data } = body

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['Content']
    if (!sheet) return NextResponse.json({ error: 'Sheet Content not found' }, { status: 404 })

    await sheet.loadHeaderRow()
    let newHeaders = [...sheet.headerValues]
    let headerChanged = false
    if (!newHeaders.includes('kpiId')) { newHeaders.push('kpiId'); headerChanged = true; }
    if (!newHeaders.includes('link')) { newHeaders.push('link'); headerChanged = true; }
    if (!newHeaders.includes('description')) { newHeaders.push('description'); headerChanged = true; }
    if (!newHeaders.includes('meetingId')) { newHeaders.push('meetingId'); headerChanged = true; }

    if (headerChanged) {
      try { await sheet.resize({ rowCount: sheet.rowCount, columnCount: newHeaders.length }) } catch(e) {}
      await sheet.setHeaderRow(newHeaders)
    }

    const rows = await sheet.getRows()
    const row = rows.find(r => r.get('id') === id)
    if (!row) return NextResponse.json({ error: 'Content not found' }, { status: 404 })

    const oldStatus = row.get('status')
    const oldKpiId = row.get('kpiId')

    const fields = ['title', 'type', 'platform', 'company', 'memberId', 'link', 'kpiId', 'description', 'meetingId']
    fields.forEach(f => {
      if (data[f] !== undefined) row.assign({ [f]: data[f] })
    })

    if (data.publishDate !== undefined) {
      row.assign({ publishDate: data.publishDate ? new Date(data.publishDate).toISOString() : '' })
    }

    if (status !== undefined) row.assign({ status })

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
      const title = data.title || row.get('title')
      const memberId = data.memberId || row.get('memberId')
      const mRows = doc.sheetsByTitle['TeamMember'] ? await doc.sheetsByTitle['TeamMember'].getRows() : []
      const mRow = mRows.find(r => r.get('id') === memberId)
      const memberName = mRow ? mRow.get('name') : 'ไม่ระบุ'
      
      /*
      try {
        const pDate = data.publishDate !== undefined ? data.publishDate : row.get('publishDate')
        const message = `\n✏️ [แก้ไขคอนเทนต์] ${title}\n👤 รับผิดชอบ: ${memberName}\n📅 เผยแพร่: ${pDate ? new Date(pDate).toLocaleDateString('th-TH') : '-'}`
        const { sendLineNotify } = await import('@/lib/line-notify')
        await sendLineNotify(message)
      } catch (e) {
        console.error('Error sending line notify:', e)
      }
      */
    }

    return NextResponse.json({ id, status, ...data })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const doc = await initDoc()
    const sheet = doc.sheetsByTitle['Content']
    if (!sheet) return NextResponse.json({ error: 'Sheet Content not found' }, { status: 404 })

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
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 })
  }
}
