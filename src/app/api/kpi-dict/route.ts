import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DICT_TITLE = '__SYSTEM_KPI_DICTIONARY__'

export async function GET() {
  try {
    const note = await prisma.ideaNote.findFirst({
      where: { title: DICT_TITLE }
    })
    
    const dictionary = note?.description ? JSON.parse(note.description) : [
      { id: '1', name: 'ยอดผู้ติดตาม (Followers)', description: 'เป้าหมายการเพิ่มจำนวนผู้ติดตามใหม่ในช่องทางโซเชียลมีเดียต่างๆ เช่น Facebook, TikTok' },
      { id: '2', name: 'บทความที่เขียน (Articles)', description: 'จำนวนคอนเทนต์บทความหรือบล็อกที่เขียนและเผยแพร่สำเร็จในแต่ละเดือน' },
      { id: '3', name: 'คลิปวิดีโอ (Videos)', description: 'จำนวนคลิปวิดีโอสั้นหรือยาวที่ผลิตและเผยแพร่สำเร็จ (รวมการตัดต่อและถ่ายทำ)' },
      { id: '4', name: 'งานออกแบบ (Design)', description: 'จำนวนชิ้นงานกราฟิก ภาพประกอบ หรือสื่อสิ่งพิมพ์ที่ออกแบบเสร็จสมบูรณ์' }
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
