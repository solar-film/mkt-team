import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncedPlatforms, windsorConfigured } from '@/lib/windsor';
import { getGbpSyncInfo } from '@/lib/gbp-sync';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

export interface AdsSyncLive { platform: string; lastAt: string | null; lastOk: boolean; lastOkAt: string | null }
export interface GbpSyncLive {
  configured: boolean;
  lastSyncedAt: string | null;
  lastSyncOk: boolean | null;
  lastSyncMessage: string | null;
}
export interface DataSourcesLive {
  windsorConfigured: boolean;
  ads: AdsSyncLive[];
  sheetUrl: string | null;
  gbp: GbpSyncLive | null;
}

/**
 * Live part of the แหล่งข้อมูล page: the latest Windsor pull per platform, GBP sheet sync status,
 * and a link to the summary sheet. Members only — the proxy rejects requests without a valid session.
 * The sheet id stays in the environment/DB, never in this public repository.
 */
export async function GET() {
  const sheetId = process.env.COMPANY_STATS_SHEET_ID?.trim();
  const sheetUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit` : null;
  try {
    const [runs, okRuns, gbpInfo] = await Promise.all([
      prisma.adSyncRun.findMany({ distinct: ['platform'], orderBy: { startedAt: 'desc' } }),
      prisma.adSyncRun.findMany({ where: { ok: true }, distinct: ['platform'], orderBy: { startedAt: 'desc' } }),
      getGbpSyncInfo().catch(() => null),
    ]);
    // A platform typed in by hand has no Windsor pull to report on.
    const ads: AdsSyncLive[] = syncedPlatforms().map(platform => {
      const last = runs.find(run => run.platform === platform);
      const lastOk = okRuns.find(run => run.platform === platform);
      return {
        platform,
        lastAt: last ? (last.finishedAt ?? last.startedAt).toISOString() : null,
        lastOk: last?.ok ?? false,
        lastOkAt: lastOk ? (lastOk.finishedAt ?? lastOk.startedAt).toISOString() : null,
      };
    });
    const gbp: GbpSyncLive | null = gbpInfo
      ? {
          configured: gbpInfo.configured,
          lastSyncedAt: gbpInfo.lastSyncedAt,
          lastSyncOk: gbpInfo.lastSyncOk,
          lastSyncMessage: gbpInfo.lastSyncMessage,
        }
      : null;
    const body: DataSourcesLive = { windsorConfigured: windsorConfigured(), ads, sheetUrl, gbp };
    return NextResponse.json(body, { headers });
  } catch (error) {
    console.error('Data sources read failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers });
  }
}
