import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const next3Days = new Date(today)
    next3Days.setDate(next3Days.getDate() + 3)

    const pendingTasks = await prisma.task.findMany({
      where: {
        status: { not: 'done' },
        deadline: { not: null }
      },
      include: {
        member: { select: { id: true, name: true } }
      }
    })

    const tasksDueSoon = pendingTasks.filter(task => {
      if (!task.deadline) return false
      const deadline = new Date(task.deadline)
      deadline.setHours(0, 0, 0, 0)
      
      const diffTime = deadline.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      return diffDays === 1 || diffDays === 3 || diffDays < 0
    })

    if (tasksDueSoon.length === 0) {
      return NextResponse.json({ message: 'No tasks due soon' })
    }

    let messageText = '🚨 *แจ้งเตือนกำหนดส่งงาน* 🚨\n\n'
    
    const dueTomorrow = tasksDueSoon.filter(t => {
      const diffDays = Math.ceil((new Date(t.deadline!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return diffDays === 1
    })
    
    const due3Days = tasksDueSoon.filter(t => {
      const diffDays = Math.ceil((new Date(t.deadline!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return diffDays === 3
    })
    
    const overdue = tasksDueSoon.filter(t => {
      const diffDays = Math.ceil((new Date(t.deadline!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return diffDays < 0
    })

    if (overdue.length > 0) {
      messageText += '🔥 *เลยกำหนดแล้ว:*\n'
      overdue.forEach(t => {
        messageText += `- ${t.title} (@${t.member.name})\n`
      })
      messageText += '\n'
    }

    if (dueTomorrow.length > 0) {
      messageText += '⏰ *ต้องส่งพรุ่งนี้:*\n'
      dueTomorrow.forEach(t => {
        messageText += `- ${t.title} (@${t.member.name})\n`
      })
      messageText += '\n'
    }

    if (due3Days.length > 0) {
      messageText += '⏳ *ต้องส่งในอีก 3 วัน:*\n'
      due3Days.forEach(t => {
        messageText += `- ${t.title} (@${t.member.name})\n`
      })
    }

    const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN
    const LINE_GROUP_ID = process.env.LINE_GROUP_ID
    
    if (LINE_TOKEN && LINE_GROUP_ID) {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_TOKEN}`
        },
        body: JSON.stringify({
          to: LINE_GROUP_ID,
          messages: [{ type: 'text', text: messageText }]
        })
      })
    }

    return NextResponse.json({ success: true, notifiedCount: tasksDueSoon.length })
  } catch (error) {
    console.error('Cron Error:', error)
    return NextResponse.json({ error: 'Failed to process cron' }, { status: 500 })
  }
}
