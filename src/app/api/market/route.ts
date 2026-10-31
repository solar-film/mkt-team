import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bangkokDateKey } from '@/lib/bangkok-date';
import {
  brandOf, isMonthKey, isPlatform, PLATFORMS, shiftMonth,
  type CampaignRow, type DayRow, type MarketData, type MonthRow, type SyncStatus,
} from '@/lib/ads-data';
import { windsorConfigured } from '@/lib/windsor';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };
const METRICS = { spend: true, impressions: true, clicks: true, leads: true, messages: true } as const;

/**
 * Everything the ข้อมูลตลาด pages need for one month: monthly totals for this and last year,
 * plus campaigns and days for the month, the month before and the same month last year.
 * Members only — the proxy rejects requests without a valid session.
 */
export async function GET(request: Request) {
  const today = bangkokDateKey(new Date());
  const asked = new URL(request.url).searchParams.get('month');
  const month = isMonthKey(asked) ? asked : today.slice(0, 7);
  const year = Number(month.slice(0, 4));
  const compared = [month, shiftMonth(month, -1), shiftMonth(month, -12)];

  try {
    const [monthGroups, campaignGroups, dayGroups, first, runs, okRuns, latest] = await Promise.all([
      prisma.adDaily.groupBy({
        by: ['platform', 'accountName', 'month'],
        where: { month: { gte: `${year - 1}-01`, lte: `${year}-12` } },
        _sum: METRICS,
      }),
      prisma.adDaily.groupBy({
        by: ['platform', 'accountName', 'campaignId', 'campaignName', 'month'],
        where: { month: { in: compared } },
        _sum: METRICS,
      }),
      prisma.adDaily.groupBy({
        by: ['platform', 'accountName', 'date'],
        where: { month: { in: compared } },
        _sum: METRICS,
      }),
      prisma.adDaily.findFirst({ orderBy: { date: 'asc' }, select: { month: true } }),
      prisma.adSyncRun.findMany({ distinct: ['platform'], orderBy: { startedAt: 'desc' } }),
      prisma.adSyncRun.findMany({ where: { ok: true }, distinct: ['platform'], orderBy: { startedAt: 'desc' } }),
      prisma.adDaily.groupBy({ by: ['platform'], _max: { date: true } }),
    ]);

    const metrics = (sum: Partial<Record<keyof typeof METRICS, number | null>>) => ({
      spend: sum.spend ?? 0, impressions: sum.impressions ?? 0, clicks: sum.clicks ?? 0,
      leads: sum.leads ?? 0, messages: sum.messages ?? 0,
    });
    const known = <T extends { platform: string }>(rows: T[]) => rows.filter(row => isPlatform(row.platform));

    const months: MonthRow[] = known(monthGroups).map(g => ({
      platform: g.platform as MonthRow['platform'], brand: brandOf(g.accountName), month: g.month, ...metrics(g._sum),
    }));
    const campaigns: CampaignRow[] = known(campaignGroups).map(g => ({
      platform: g.platform as CampaignRow['platform'], brand: brandOf(g.accountName), accountName: g.accountName,
      campaignId: g.campaignId, campaignName: g.campaignName, month: g.month, ...metrics(g._sum),
    }));
    const days: DayRow[] = known(dayGroups).map(g => ({
      platform: g.platform as DayRow['platform'], brand: brandOf(g.accountName),
      date: g.date.toISOString().slice(0, 10), ...metrics(g._sum),
    }));
    const sync: SyncStatus[] = PLATFORMS.map(platform => {
      const run = runs.find(r => r.platform === platform);
      return {
        platform,
        lastRunAt: run?.startedAt.toISOString() ?? null,
        lastOk: run ? run.ok : null,
        lastMessage: run?.message ?? null,
        lastOkAt: okRuns.find(r => r.platform === platform)?.finishedAt?.toISOString() ?? null,
        latestDate: latest.find(l => l.platform === platform)?._max.date?.toISOString().slice(0, 10) ?? null,
      };
    });

    const data: MarketData = { configured: windsorConfigured(), month, today, firstMonth: first?.month ?? null, months, campaigns, days, sync };
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('Market data failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'โหลดข้อมูลตลาดไม่สำเร็จ' }, { status: 500, headers });
  }
}
