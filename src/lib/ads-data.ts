// Shared by the Windsor sync (server) and the ข้อมูลตลาด pages (browser): no Node or database imports here.

export const PLATFORMS = ['google_ads', 'facebook', 'openai_ads'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_INFO: Record<Platform, { label: string; slug: string; resultLabel: string }> = {
  google_ads: { label: 'Google Ads', slug: 'google', resultLabel: 'Conversions' },
  facebook: { label: 'Facebook Ads', slug: 'facebook', resultLabel: 'ลีด + แชท' },
  openai_ads: { label: 'ChatGPT Ads', slug: 'chatgpt', resultLabel: 'Conversions' },
};

export const isPlatform = (value: unknown): value is Platform => PLATFORMS.includes(value as Platform);

/**
 * Windsor field ids per connector, and which of them count as a lead or a chat.
 * facebook and openai_ads were checked against Windsor's field list on 31 Oct 2026;
 * google_ads was not connected yet, so its ids follow Windsor's documented defaults.
 */
export const WINDSOR_FIELDS: Record<Platform, { fields: string[]; leads: string[]; messages: string[]; currency?: string }> = {
  facebook: {
    fields: ['date', 'account_id', 'account_name', 'account_currency', 'campaign_id', 'campaign', 'spend', 'impressions', 'clicks',
      'actions_lead', 'actions_onsite_conversion_messaging_conversation_started_7d'],
    leads: ['actions_lead'],
    messages: ['actions_onsite_conversion_messaging_conversation_started_7d'],
    currency: 'account_currency',
  },
  google_ads: {
    fields: ['date', 'account_id', 'account_name', 'campaign_id', 'campaign', 'spend', 'impressions', 'clicks', 'conversions'],
    leads: ['conversions'],
    messages: [],
  },
  openai_ads: {
    fields: ['date', 'account_id', 'account_name', 'campaign_id', 'campaign', 'spend', 'impressions', 'clicks', 'conversions'],
    leads: ['conversions'],
    messages: [],
  },
};

/** The four businesses of the โครงสร้างธุรกิจ page, plus a bucket for accounts none of them claims. */
export const BRANDS = ['GFS B2B', 'GFS B2C', 'MHL อาคาร', 'MHL CAR', 'อื่น ๆ'] as const;
export type Brand = (typeof BRANDS)[number];

const squash = (text: string) => text.toLowerCase().replace(/\s+/g, '');
// Campaign names that mark wholesale work on the Goodfilm page account shared by GFS B2B and GFS B2C.
const GFS_B2B_CAMPAIGN = /b2b|ขายส่ง|ยกม้วน|3mgoodfilm/;

/**
 * Business of an ad account (and, on the shared Goodfilm page account, of the campaign), read from names
 * because account ids stay out of this public repository. GFS accounts are B2C unless marked B2B.
 */
export function brandOf(accountName: string, campaignName = ''): Brand {
  const name = squash(accountName);
  if (/car/.test(name)) return 'MHL CAR';
  if (/maholan|mhl|มโหฬาร/.test(name)) return 'MHL อาคาร';
  if (/goodfilm|gfs|กู๊ดฟิล์ม/.test(name)) {
    // 3m-goodfilm.com is the wholesale site (owner confirmed 1 Nov 2026).
    if (/b2b|^3m-?goodfilm/.test(name)) return 'GFS B2B';
    if (/goodfilmco/.test(name) && GFS_B2B_CAMPAIGN.test(squash(campaignName))) return 'GFS B2B';
    return 'GFS B2C';
  }
  return 'อื่น ๆ';
}

export interface Metrics {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  messages: number;
}

export const emptyMetrics = (): Metrics => ({ spend: 0, impressions: 0, clicks: 0, leads: 0, messages: 0 });

export function addMetrics(into: Metrics, from: Metrics): Metrics {
  into.spend += from.spend;
  into.impressions += from.impressions;
  into.clicks += from.clicks;
  into.leads += from.leads;
  into.messages += from.messages;
  return into;
}

export const sumMetrics = (rows: Metrics[]) => rows.reduce((total, row) => addMetrics(total, row), emptyMetrics());

/** Leads plus chats: what one ad "result" means on these pages. */
export const results = (m: Metrics) => m.leads + m.messages;

const ratio = (top: number, bottom: number) => (bottom > 0 ? top / bottom : null);
export const ctr = (m: Metrics) => ratio(m.clicks, m.impressions);
export const cpc = (m: Metrics) => ratio(m.spend, m.clicks);
export const cpm = (m: Metrics) => ratio(m.spend * 1000, m.impressions);
export const costPerResult = (m: Metrics) => ratio(m.spend, results(m));

/** Relative change from `before` to `now`; null when there is nothing to compare against. */
export function change(now: number | null, before: number | null): number | null {
  if (now === null || before === null || before === 0) return null;
  return (now - before) / before;
}

// ---------- months (YYYY-MM) ----------

export const isMonthKey = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split('-').map(Number);
  const index = year * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export const daysInMonth = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
};

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const thaiMonthShort = (monthNumber: number) => THAI_MONTHS[monthNumber - 1];
/** "ต.ค. 69" for 2026-10 (Buddhist year, two digits, as the team writes it). */
export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${THAI_MONTHS[m - 1]} ${String(year + 543).slice(-2)}`;
}

// ---------- Windsor rows ----------

export interface AdRow extends Metrics {
  platform: Platform;
  accountId: string;
  accountName: string;
  campaignId: string;
  campaignName: string;
  date: string; // YYYY-MM-DD
  currency: string;
}

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim());
function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}
const sumOf = (row: Record<string, unknown>, keys: string[]) => keys.reduce((total, key) => total + num(row[key]), 0);

/**
 * Turns Windsor's JSON rows into one row per account + campaign + day. Rows Windsor splits
 * further are summed, and days with no spend and no impressions are dropped as noise.
 */
export function normalizeWindsorRows(platform: Platform, data: unknown): AdRow[] {
  if (!Array.isArray(data)) throw new Error('Windsor response has no data array');
  const spec = WINDSOR_FIELDS[platform];
  const merged = new Map<string, AdRow>();
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const date = text(row.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const accountId = text(row.account_id) || text(row.account_name) || 'unknown';
    const campaignId = text(row.campaign_id) || text(row.campaign) || 'unknown';
    const metrics: Metrics = {
      spend: num(row.spend), impressions: num(row.impressions), clicks: num(row.clicks),
      leads: sumOf(row, spec.leads), messages: sumOf(row, spec.messages),
    };
    if (metrics.spend === 0 && metrics.impressions === 0) continue;
    const key = `${accountId}\u0000${campaignId}\u0000${date}`;
    const existing = merged.get(key);
    if (existing) { addMetrics(existing, metrics); continue; }
    merged.set(key, {
      platform, accountId, campaignId, date,
      accountName: text(row.account_name) || accountId,
      campaignName: text(row.campaign) || campaignId,
      currency: (spec.currency && text(row[spec.currency])) || 'THB',
      ...metrics,
    });
  }
  return [...merged.values()];
}

// ---------- Google Ads keywords ----------

export const KEYWORD_KINDS = ['keyword', 'search_term'] as const;
export type KeywordKind = (typeof KEYWORD_KINDS)[number];

/** Windsor google_ads fields per kind (checked against Windsor's field list on 1 Nov 2026). */
export const KEYWORD_FIELDS: Record<KeywordKind, { text: string; match?: string; fields: string[] }> = {
  keyword: {
    text: 'keyword_text', match: 'keyword_match_type',
    fields: ['account_id', 'account_name', 'keyword_text', 'keyword_match_type', 'spend', 'impressions', 'clicks', 'conversions'],
  },
  search_term: {
    text: 'search_term',
    fields: ['account_id', 'account_name', 'search_term', 'spend', 'impressions', 'clicks', 'conversions'],
  },
};

// Rows kept per account, kind and month: enough that the overall top 30 is always exact.
export const KEYWORDS_KEPT_PER_ACCOUNT = 200;

export interface KeywordStat {
  kind: KeywordKind;
  accountId: string;
  accountName: string;
  text: string;
  matchType: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

/** One row per account + text + match type for a month, biggest spend first, capped per account. */
export function normalizeKeywordRows(kind: KeywordKind, data: unknown): KeywordStat[] {
  if (!Array.isArray(data)) throw new Error('Windsor response has no data array');
  const spec = KEYWORD_FIELDS[kind];
  const merged = new Map<string, KeywordStat>();
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const keywordText = text(row[spec.text]);
    const spend = num(row.spend);
    const impressions = num(row.impressions);
    if (!keywordText || (spend === 0 && impressions === 0)) continue;
    const accountId = text(row.account_id) || text(row.account_name) || 'unknown';
    const matchType = spec.match ? text(row[spec.match]) : '';
    const key = `${accountId}\u0000${keywordText}\u0000${matchType}`;
    const stat = merged.get(key) ?? {
      kind, accountId, accountName: text(row.account_name) || accountId, text: keywordText, matchType,
      spend: 0, impressions: 0, clicks: 0, conversions: 0,
    };
    stat.spend += spend;
    stat.impressions += impressions;
    stat.clicks += num(row.clicks);
    stat.conversions += num(row.conversions);
    merged.set(key, stat);
  }
  const byAccount = new Map<string, KeywordStat[]>();
  for (const stat of merged.values()) byAccount.set(stat.accountId, [...(byAccount.get(stat.accountId) ?? []), stat]);
  return [...byAccount.values()].flatMap(rows => rows.sort((a, b) => b.spend - a.spend).slice(0, KEYWORDS_KEPT_PER_ACCOUNT));
}

// ---------- what /api/market returns ----------

export interface KeywordRow extends KeywordStat { brand: Brand; month: string }

export interface MonthRow extends Metrics { platform: Platform; brand: Brand; month: string }
export interface CampaignRow extends Metrics {
  platform: Platform; brand: Brand; accountName: string; campaignId: string; campaignName: string; month: string;
}
export interface DayRow extends Metrics { platform: Platform; brand: Brand; date: string }
export interface SyncStatus {
  platform: Platform;
  lastRunAt: string | null;
  lastOk: boolean | null;
  lastMessage: string | null;
  lastOkAt: string | null;
  latestDate: string | null;
}
/** An ad account the data is pulled from, with every business its campaigns were counted under. */
export interface AccountRow {
  platform: Platform;
  accountId: string;
  accountName: string;
  brands: Brand[];
  /** Spend in the selected month. */
  spend: number;
  firstDate: string;
  lastDate: string;
}
export interface MarketData {
  configured: boolean;
  month: string;
  today: string;
  firstMonth: string | null;
  months: MonthRow[];
  campaigns: CampaignRow[];
  days: DayRow[];
  /** Google Ads keywords and search terms for the month and the month before. */
  keywords: KeywordRow[];
  accounts: AccountRow[];
  sync: SyncStatus[];
}
