import { isMonthKey, type Platform } from './ads-data';

/**
 * Ad spend the admin types in by hand, for a platform that left the Windsor plan (ChatGPT Ads,
 * owner decision 1 Nov 2026). Stored in AdDaily as one row per month on the 1st, so every page
 * that reads ad spend counts it without changes. The Windsor sync never deletes these rows.
 */
export const MANUAL_ACCOUNT_ID = 'manual';
export const MANUAL_CAMPAIGN_ID = 'manual-month';
export const MANUAL_CAMPAIGN_NAME = 'ยอดรวมทั้งเดือน (กรอกเอง)';
export const MANUAL_PLATFORMS: Platform[] = ['openai_ads'];
// brandOf() reads "goodfilm" in the name, so typed-in ChatGPT spend stays under GFS B2C like before.
export const MANUAL_ACCOUNT_NAME: Record<string, string> = { openai_ads: 'Goodfilm ChatGPT Ads (กรอกเอง)' };

export class ManualAdsError extends Error {}

export interface ManualAdsInput { platform: Platform; month: string; spend: number; impressions: number; clicks: number; leads: number }

function amount(value: unknown, label: string): number {
  if (value === undefined || value === null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) throw new ManualAdsError(`${label} ต้องเป็นตัวเลข 0 ขึ้นไป`);
  return n;
}

export function parseManualAds(body: Record<string, unknown>): ManualAdsInput {
  const platform = body.platform ?? 'openai_ads';
  if (!MANUAL_PLATFORMS.includes(platform as Platform)) throw new ManualAdsError('ช่องทางนี้กรอกเองไม่ได้');
  if (!isMonthKey(body.month)) throw new ManualAdsError('เลือกเดือนให้ถูกต้อง');
  return {
    platform: platform as Platform,
    month: body.month,
    spend: amount(body.spend, 'ค่าใช้จ่าย'),
    impressions: Math.round(amount(body.impressions, 'Impressions')),
    clicks: Math.round(amount(body.clicks, 'Clicks')),
    leads: Math.round(amount(body.leads, 'Conversions')),
  };
}

/** Platforms the nightly Windsor sync skips: WINDSOR_SKIP_PLATFORMS=openai_ads once it leaves the plan. */
export function skippedPlatforms(env: Record<string, string | undefined> = process.env): Set<string> {
  return new Set((env.WINDSOR_SKIP_PLATFORMS ?? '').split(',').map(s => s.trim()).filter(Boolean));
}
