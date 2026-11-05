import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { brandOf, isMonthKey, shiftMonth } from '@/lib/ads-data';
import { DATASET_SOURCES, isChannel, isCompany, isDataset, type AdChatDay, type Company, type ContactData, type ContactSync } from '@/lib/contact-data';
import { adminSheetsConfigured, goodCrmConfigured } from '@/lib/contact-sync';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

const AD_COMPANY: Record<string, Company | null> = {
  'GFS B2B': 'GFS', 'GFS B2C': 'GFS', 'MHL อาคาร': 'MHL', 'MHL CAR': 'CAR', 'อื่น ๆ': null,
};

/**
 * Everything the ข้อมูลการติดต่อ pages need for one month: daily contacts for the month, the month
 * before and the same month last year, 13 months of totals, and ad chats/spend to compare against.
 * Members only — the proxy rejects requests without a valid session.
 */
export async function GET(request: Request) {
  const today = bangkokDateKey(new Date());
  const params = new URL(request.url).searchParams;
  const asked = params.get('month');
  const month = isMonthKey(asked) ? asked : today.slice(0, 7);
  const compared = [month, shiftMonth(month, -1), shiftMonth(month, -12)];
  // Live (GOOD CRM + call logs) and the admin lead sheets are different definitions: one dataset per answer.
  const dataset = isDataset(params.get('dataset')) ? params.get('dataset') as 'live' | 'sheet' : 'live';
  const source = { in: [...DATASET_SOURCES[dataset]] };
  // Monthly totals span the selected year and the one before: the 13-month series and the year comparison both fit.
  const year = Number(month.slice(0, 4));
  const monthlyRange = { gte: `${year - 1}-01`, lte: `${year}-12` };

  try {
    const [rows, monthGroups, first, adGroups, runs, okRuns, latest] = await Promise.all([
      prisma.contactDaily.findMany({ where: { source, month: { in: compared } }, orderBy: [{ date: 'asc' }, { channel: 'asc' }] }),
      prisma.contactDaily.groupBy({
        by: ['month', 'channel', 'company'],
        where: { source, month: monthlyRange },
        _sum: { contacts: true },
      }),
      prisma.contactDaily.findFirst({ where: { source }, orderBy: { date: 'asc' }, select: { month: true } }),
      prisma.adDaily.groupBy({
        by: ['platform', 'accountName', 'campaignName', 'date'],
        where: { month: { in: compared.slice(0, 2) } },
        _sum: { messages: true, spend: true },
      }),
      prisma.contactSyncRun.findMany({ distinct: ['source'], orderBy: { startedAt: 'desc' } }),
      prisma.contactSyncRun.findMany({ where: { ok: true }, distinct: ['source'], orderBy: { startedAt: 'desc' } }),
      prisma.contactDaily.groupBy({ by: ['source'], _max: { date: true } }),
    ]);

    const ads = new Map<string, AdChatDay>();
    for (const g of adGroups) {
      const company = AD_COMPANY[brandOf(g.accountName, g.campaignName)];
      if (!company) continue;
      const date = g.date.toISOString().slice(0, 10);
      const key = `${date}|${company}`;
      const day = ads.get(key) ?? { date, company, messages: 0, spend: 0 };
      // Only Facebook reports chats started from an ad; spend counts every platform.
      if (g.platform === 'facebook') day.messages += g._sum.messages ?? 0;
      day.spend += g._sum.spend ?? 0;
      ads.set(key, day);
    }

    const latestOf = (sources: readonly string[]) =>
      latest.filter(l => sources.includes(l.source)).map(l => l._max.date?.toISOString().slice(0, 10) ?? '').filter(Boolean).sort().at(-1) ?? null;
    const sync: ContactSync[] = (['goodcrm', 'phone', 'sheets'] as const).map(name => {
      const run = runs.find(r => r.source === name);
      return {
        source: name,
        lastRunAt: run?.startedAt.toISOString() ?? null,
        lastOk: run ? run.ok : null,
        lastMessage: run?.message ?? null,
        lastOkAt: okRuns.find(r => r.source === name)?.finishedAt?.toISOString() ?? null,
        latestDate: latestOf(name === 'sheets' ? DATASET_SOURCES.sheet : [name]),
      };
    });

    const data: ContactData = {
      configured: dataset === 'sheet' ? adminSheetsConfigured() : goodCrmConfigured(),
      dataset,
      month,
      today,
      firstMonth: first?.month ?? null,
      rows: rows.flatMap(r => (isChannel(r.channel) && isCompany(r.company) ? [{
        date: r.date.toISOString().slice(0, 10), channel: r.channel, company: r.company,
        account: r.account, contacts: r.contacts, newContacts: r.newContacts,
      }] : [])),
      monthly: monthGroups.flatMap(g => (isChannel(g.channel) && isCompany(g.company)
        ? [{ month: g.month, channel: g.channel, company: g.company, contacts: g._sum.contacts ?? 0 }] : [])),
      ads: [...ads.values()].sort((a, b) => a.date.localeCompare(b.date)),
      sync,
    };
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('Contact data failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'โหลดข้อมูลการติดต่อไม่สำเร็จ' }, { status: 500, headers });
  }
}
