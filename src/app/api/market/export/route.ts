import { prisma } from '@/lib/prisma';
import { brandOf, isMonthKey, isPlatform, PLATFORM_INFO, type Platform } from '@/lib/ads-data';

export const dynamic = 'force-dynamic';

/** Spreadsheet-safe cell: quoted, and text that Excel would run as a formula is prefixed. */
function cell(value: string | number): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '';
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Daily rows per campaign as CSV for analysis in Sheets/Excel. Members only (checked by the proxy). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = params.get('from');
  const to = params.get('to');
  const platform = params.get('platform');
  if (!isMonthKey(from) || !isMonthKey(to) || from > to || (platform && platform !== 'all' && !isPlatform(platform))) {
    return new Response('from/to must be YYYY-MM and platform one of google_ads, facebook, openai_ads, all', { status: 400 });
  }
  try {
    const rows = await prisma.adDaily.findMany({
      where: { month: { gte: from, lte: to }, ...(platform && platform !== 'all' ? { platform } : {}) },
      orderBy: [{ date: 'asc' }, { platform: 'asc' }, { accountName: 'asc' }, { campaignName: 'asc' }],
    });
    const header = ['วันที่', 'เดือน', 'ช่องทาง', 'ธุรกิจ', 'บัญชีโฆษณา', 'แคมเปญ', 'สกุลเงิน', 'ค่าใช้จ่าย', 'การแสดงผล', 'คลิก', 'ลีด/Conversions', 'แชทเริ่มใหม่'];
    const lines = rows.map(r => [
      r.date.toISOString().slice(0, 10), r.month, PLATFORM_INFO[r.platform as Platform]?.label ?? r.platform,
      brandOf(r.accountName, r.campaignName), r.accountName, r.campaignName, r.currency,
      r.spend, r.impressions, r.clicks, r.leads, r.messages,
    ].map(cell).join(','));
    const csv = '﻿' + [header.map(cell).join(','), ...lines].join('\r\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ads_${platform && platform !== 'all' ? platform : 'all'}_${from}_${to}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Market export failed:', error instanceof Error ? error.message : 'unknown error');
    return new Response('Export failed', { status: 500 });
  }
}
