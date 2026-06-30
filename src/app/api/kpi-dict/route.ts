import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DICT_TITLE = '__SYSTEM_KPI_DICTIONARY__'

export async function GET() {
  try {
    const fs = require('fs')
    const path = require('path')
    const dictPath = path.join(process.cwd(), 'new_dict.json')
    
    // Check if new_dict.json exists, and if so, use it to override the database
    if (fs.existsSync(dictPath)) {
      const newDictString = fs.readFileSync(dictPath, 'utf8')
      const dictionary = JSON.parse(newDictString)
      return NextResponse.json(dictionary)
    }

    // Fallback if file doesn't exist for some reason
    const note = await prisma.ideaNote.findFirst({
      where: { title: DICT_TITLE }
    })
    
    const dictionary = note?.description ? JSON.parse(note.description) : [
      { id: '1', name: 'ผู้ติดตาม (Followers)', description: 'เพิ่มผู้ติดตามในช่องทางต่างๆ เพื่อสร้างฐานคนดูที่มั่นคง (เน้นที่ Facebook, TikTok' },
      { id: '2', name: 'บทความ (Articles)', description: 'ทำคอนเทนต์ให้ความรู้เรื่องฟิล์มกรองแสง เพื่อสร้างความน่าเชื่อถือในตัวแบรนด์' },
      { id: '3', name: 'คลิปวิดีโอ (Videos)', description: 'ทำคลิปวิดีโอสั้นหรือยาว เพื่อสร้างการรับรู้แบรนด์ (ไม่เน้นยอดขายโดยตรง)' },
      { id: '4', name: 'งานออกแบบ (Design)', description: 'ทำชิ้นงานกราฟิก ภาพประกอบ ปกคลิป หรือแบนเนอร์ เพื่อสนับสนุนงานสื่อต่างๆ' }
    ];
    
    return NextResponse.json(dictionary)
  } catch (error) {
    console.error('Error fetching KPI dictionary:', error)
    return NextResponse.json({ error: 'Failed to fetch dictionary' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const jsonString = JSON.stringify(body)
    
    const note = await prisma.ideaNote.findFirst({
      where: { title: DICT_TITLE }
    })
    
    if (note) {
      await prisma.ideaNote.update({
        where: { id: note.id },
        data: { description: jsonString }
      })
    } else {
      await prisma.ideaNote.create({
        data: {
          title: DICT_TITLE,
          description: jsonString,
          category: 'system'
        }
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating KPI dictionary:', error)
    return NextResponse.json({ error: 'Failed to update dictionary' }, { status: 500 })
  }
}
