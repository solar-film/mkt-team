import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasAdminSession } from '@/lib/admin-session';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import { invalidateWorkspace } from '@/lib/workspace-cache';
import { isMonthKey } from '@/lib/ads-data';
import {
  MANUAL_ACCOUNT_ID, MANUAL_ACCOUNT_NAME, MANUAL_CAMPAIGN_ID, MANUAL_CAMPAIGN_NAME, ManualAdsError, parseManualAds,
} from '@/lib/manual-ads';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };
const firstDay = (month: string) => new Date(`${month}-01T00:00:00.000Z`);

/** Months of typed-in ChatGPT Ads spend, newest first. Admin password session only. */
export async function GET(request: Request) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  const rows = await prisma.adDaily.findMany({
    where: { accountId: MANUAL_ACCOUNT_ID }, orderBy: { date: 'desc' },
    select: { platform: true, month: true, spend: true, impressions: true, clicks: true, leads: true, syncedAt: true },
  });
  return NextResponse.json({ rows: rows.map(r => ({ ...r, syncedAt: r.syncedAt.toISOString() })) }, { headers });
}

/** Saves one month (replacing any earlier figure for it). */
export async function POST(request: Request) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  try {
    const input = parseManualAds(await readJsonBody(request));
    const date = firstDay(input.month);
    const figures = { spend: input.spend, impressions: input.impressions, clicks: input.clicks, leads: input.leads, syncedAt: new Date() };
    await prisma.adDaily.upsert({
      where: { platform_accountId_campaignId_date: { platform: input.platform, accountId: MANUAL_ACCOUNT_ID, campaignId: MANUAL_CAMPAIGN_ID, date } },
      create: {
        platform: input.platform, accountId: MANUAL_ACCOUNT_ID, accountName: MANUAL_ACCOUNT_NAME[input.platform],
        campaignId: MANUAL_CAMPAIGN_ID, campaignName: MANUAL_CAMPAIGN_NAME, date, month: input.month, ...figures,
      },
      update: figures,
    });
    invalidateWorkspace();
    return NextResponse.json({ saved: input }, { headers });
  } catch (error) {
    if (error instanceof ManualAdsError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    console.error('Manual ads save failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500, headers });
  }
}

/** Removes one typed-in month: ?platform=openai_ads&month=2026-11 */
export async function DELETE(request: Request) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  const params = new URL(request.url).searchParams;
  const month = params.get('month');
  const platform = params.get('platform') || 'openai_ads';
  if (!isMonthKey(month)) return NextResponse.json({ error: 'เลือกเดือนให้ถูกต้อง' }, { status: 400, headers });
  await prisma.adDaily.deleteMany({ where: { platform, accountId: MANUAL_ACCOUNT_ID, month } });
  invalidateWorkspace();
  return NextResponse.json({ deleted: month }, { headers });
}
