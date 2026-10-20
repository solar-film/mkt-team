import { cachedJsonRead } from '@/lib/workspace-cache'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bangkokDateKey } from '@/lib/bangkok-date'
import { STATS_TRACKING_START_UTC, pendingStats, pendingStatsFor } from '@/lib/stats-due'

export const dynamic = 'force-dynamic'

/** Content statistics snapshots that are due but not yet recorded, most overdue first. */
async function readGET(request: Request) {
  try {
    const memberId = new URL(request.url).searchParams.get('memberId') || 'all'
    const contents = await prisma.content.findMany({
      where: { publishDate: { gte: STATS_TRACKING_START_UTC } },
      select: {
        id: true, title: true, status: true, platform: true, company: true, publishDate: true,
        memberId: true, memberIds: true, metrics: { select: { snapshot: true } },
      },
    })
    const items = pendingStatsFor(pendingStats(contents), memberId)
    return NextResponse.json({ items, total: items.length, overdue: items.filter(item => item.daysOverdue > 0).length })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to load statistics reminders' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  // The Thai date is part of the key so newly due snapshots appear after midnight.
  const key = ['content-metrics-due', url.searchParams.get('memberId') || 'all', bangkokDateKey(new Date())]
  const snapshot = new Request(url)
  return cachedJsonRead(key, () => readGET(snapshot), url.searchParams.get('fresh') === '1')
}
