import { parseSelection } from './assignments';

export type ContentKpi = { id: string; name: string; memberId: string; month: number; year: number };

/** True when a KPI name is about the given platform (or no platform is chosen yet). */
export function isKpiMatchPlatform(kpiName: string, platform: string) {
  if (!platform) return true;
  const p = platform.toLowerCase();
  const k = kpiName.toLowerCase();
  if (p === 'facebook' && (k.includes('facebook') || k.includes('fb'))) return true;
  if (p === 'instagram' && (k.includes('instagram') || k.includes('ig'))) return true;
  if (p === 'tiktok' && (k.includes('tiktok') || k.includes('tt'))) return true;
  if (p === 'youtube' && (k.includes('youtube') || k.includes('yt'))) return true;
  if (p === 'icons' && k.includes('icons')) return true;
  return k.includes(p);
}

/**
 * KPIs a content can be linked to: its assignees' KPIs in the month of its publish date that
 * match its platform, shortest name first. Same rule as the content form on the tasks page.
 */
export function contentKpiOptions<T extends ContentKpi>(kpis: readonly T[], memberSelection: unknown, publishDate: string | null | undefined, platform: string): T[] {
  if (!publishDate) return [];
  const date = new Date(publishDate);
  if (Number.isNaN(date.getTime())) return [];
  const ids = parseSelection(memberSelection);
  return kpis
    .filter(k => ids.includes(k.memberId) && k.month === date.getMonth() + 1 && k.year === date.getFullYear() && k.name !== 'งานทั่วไป' && isKpiMatchPlatform(k.name, platform))
    .sort((a, b) => a.name.length - b.name.length);
}
