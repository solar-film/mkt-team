import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notificationMembers, notificationMemberLabel } from '@/lib/notification-assignees'
import { secretMatches } from '@/lib/integration-security'
import { STATS_TRACKING_START_UTC, pendingStats, statsReminderText } from '@/lib/stats-due'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 })
  if (!secretMatches(request.headers.get('authorization'), `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
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

    // Content statistics that are due but not recorded (content published from 1 Oct 2026).
    const statsContents = await prisma.content.findMany({
      where: { publishDate: { gte: STATS_TRACKING_START_UTC } },
      select: {
        id: true, title: true, status: true, platform: true, company: true, publishDate: true,
        memberId: true, memberIds: true, metrics: { select: { snapshot: true } },
      },
    })
    const statsDue = pendingStats(statsContents)

    if (tasksDueSoon.length === 0 && statsDue.length === 0) {
      return NextResponse.json({ message: 'No tasks due soon' })
    }

    let messageText = ''
    if (tasksDueSoon.length > 0) {
      const members = await notificationMembers(tasksDueSoon, prisma)

      messageText += '🚨 *แจ้งเตือนกำหนดส่งงาน* 🚨\n\n'
      
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
          messageText += `- ${t.title} (@${notificationMemberLabel(t, members)})\n`
        })
        messageText += '\n'
      }

      if (dueTomorrow.length > 0) {
        messageText += '⏰ *ต้องส่งพรุ่งนี้:*\n'
        dueTomorrow.forEach(t => {
          messageText += `- ${t.title} (@${notificationMemberLabel(t, members)})\n`
        })
        messageText += '\n'
      }

      if (due3Days.length > 0) {
        messageText += '⏳ *ต้องส่งในอีก 3 วัน:*\n'
        due3Days.forEach(t => {
          messageText += `- ${t.title} (@${notificationMemberLabel(t, members)})\n`
        })
      }
    }

    if (statsDue.length > 0) {
      const ownerIds = [...new Set(statsDue.flatMap(item => item.ownerIds).filter(id => id && id !== 'all'))]
      const owners = ownerIds.length ? await prisma.teamMember.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } }) : []
      messageText += `${messageText ? '\n' : ''}${statsReminderText(statsDue, new Map(owners.map(owner => [owner.id, owner.name])))}`
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

    return NextResponse.json({ success: true, notifiedCount: tasksDueSoon.length, statsPending: statsDue.length })
  } catch (error) {
    console.error('Cron Error:', error)
    return NextResponse.json({ error: 'Failed to process cron' }, { status: 500 })
  }
}
