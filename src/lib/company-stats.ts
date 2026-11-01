// Parses the "Good Group · ยอดใช้โฆษณา" summary sheet that มะลิ rewrites every morning.
// The figures are shown to everyone on the site (approved design, 23 Oct 2026) but are read
// from the sheet at run time and never stored in this public repository. Sections are found
// by their header labels, not fixed row numbers, so small layout edits do not shift the data.

import type { BusinessKey } from './company-structure';

export interface AdSpendRow { business: string; channel: string; month: number; ytd: number; lastYear: number }
/** An ad account from the sheet's ตั้งค่า tab; `business` may name two businesses ("GFS B2B / GFS B2C"). */
export interface AdAccount { channel: string; id: string; name: string; business: string; note: string }
/** Spend over the same completed months (Jan..compareThroughMonth) of this year and last year. */
export interface AdCompareRow { business: string; channel: string; thisYear: number; lastYear: number }
export interface BudgetRow { business: string; budget: number; used: number; usedPct: number; left: number; lastYear: number }
export interface SalesRow {
  business: string; target: number; sold: number; adPctOfSales: number | null; soldThisMonth: number;
  /** Jan..Dec of the data year; null where the sheet has no figure yet. */
  monthly: (number | null)[];
  /** Where each run of months comes from, per the sheet's ที่มา column (months are 1..12). */
  sources: { from: number; to: number; text: string }[];
}
export interface CompanyStats {
  month: string; dataThrough: string; updatedAt: string; year: number;
  /** Share of the year elapsed, 0..1, as stated by the sheet. */
  yearPct: number;
  adSpend: AdSpendRow[]; budgets: BudgetRow[]; sales: SalesRow[];
  accounts: AdAccount[];
  /** The summary tab's own "ที่มา: …" line, if present. */
  sourceNote: string | null;
  /** Last fully finished month (1..12) used for the year-on-year comparison; 0 when none. */
  compareThroughMonth: number;
  adCompare: AdCompareRow[];
  /** Where the ad-spend figures come from: the sheet, or the site's own Windsor pulls (since 1 Nov 2026). */
  adsSource: 'sheet' | 'windsor';
  /** Last day the ad-spend figures cover; sales keep `dataThrough`. */
  adsThrough: string;
  /** Share of the year elapsed at `adsThrough`, 0..1. */
  adsYearPct: number;
}

export class CompanyStatsFormatError extends Error {
  constructor(detail: string) { super(`Company stats sheet layout not recognised: ${detail}`); }
}

type Rows = unknown[][];
const text = (value: unknown) => (value == null ? '' : String(value)).trim();

/** "1,234,567" → 1234567 · "12.3%" → 0.123 · "" → NaN */
export function sheetNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const raw = text(value).replace(/,/g, '').replace(/\s/g, '');
  if (!raw) return NaN;
  const percent = raw.endsWith('%');
  const parsed = Number(percent ? raw.slice(0, -1) : raw);
  // toPrecision drops float noise such as 12.3 / 100 = 0.12300000000000001.
  return percent ? Number((parsed / 100).toPrecision(12)) : parsed;
}

function required(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new CompanyStatsFormatError(`missing number for ${label}`);
  return value;
}

/** Rows after the header row whose first cell is `label`, up to the next blank row. */
function section(rows: Rows, label: string, second?: string): Rows {
  const start = rows.findIndex(row => text(row[0]) === label && (second === undefined || text(row[1]) === second));
  if (start < 0) throw new CompanyStatsFormatError(`section "${label}" not found`);
  const body: Rows = [];
  for (const row of rows.slice(start + 1)) {
    if (!row || !text(row[0])) break;
    body.push(row);
  }
  if (!body.length) throw new CompanyStatsFormatError(`section "${label}" is empty`);
  return body;
}

function labelled(rows: Rows, label: string): string {
  for (const row of rows) {
    const index = row.findIndex(cell => text(cell) === label);
    if (index >= 0 && text(row[index + 1])) return text(row[index + 1]);
  }
  throw new CompanyStatsFormatError(`"${label}" not found`);
}

/** Ad accounts from the ตั้งค่า tab (header row starts with "ช่องทาง"); "ยังไม่นับ" accounts are skipped. */
function parseAccounts(settings: Rows): AdAccount[] {
  if (!settings.some(row => text(row[0]) === 'ช่องทาง')) return [];
  return section(settings, 'ช่องทาง')
    .map(row => ({ channel: text(row[0]), id: text(row[1]), name: text(row[2]), business: text(row[3]), note: text(row[4]) }))
    .filter(account => account.id && account.business && account.business !== 'ยังไม่นับ');
}

/** Last complete month of the data year: the data month itself only when the data reaches its last day. */
function lastCompleteMonth(dataThrough: string): number {
  const [y, m, d] = dataThrough.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d >= monthEnd ? m : m - 1;
}

/** Per business+channel spend for Jan..throughMonth of `year` and `year - 1`, from the รายเดือน tab. */
function compareAdSpend(monthlyAds: Rows, adSpend: AdSpendRow[], year: number, throughMonth: number): AdCompareRow[] {
  const totals = new Map<string, { thisYear: number; lastYear: number }>();
  for (const row of monthlyAds.slice(1)) {
    const match = /^(\d{4})-(\d{2})$/.exec(text(row[0]));
    const amount = sheetNumber(row[5]);
    if (!match || !Number.isFinite(amount) || Number(match[2]) > throughMonth) continue;
    const rowYear = Number(match[1]);
    if (rowYear !== year && rowYear !== year - 1) continue;
    const key = `${text(row[1])}|${text(row[2])}`;
    const total = totals.get(key) ?? { thisYear: 0, lastYear: 0 };
    if (rowYear === year) total.thisYear += amount; else total.lastYear += amount;
    totals.set(key, total);
  }
  return adSpend.map(({ business, channel }) => ({ business, channel, ...(totals.get(`${business}|${channel}`) ?? { thisYear: 0, lastYear: 0 }) }));
}

export function parseCompanyStats(summary: Rows, salesByMonth: Rows, settings: Rows = [], monthlyAds: Rows = []): CompanyStats {
  const dataThrough = labelled(summary, 'ข้อมูลถึงวันที่');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataThrough)) throw new CompanyStatsFormatError('bad data date');
  const year = Number(dataThrough.slice(0, 4));

  const adSpend = section(summary, 'ธุรกิจ', 'ช่องทาง').map(row => ({
    business: text(row[0]), channel: text(row[1]),
    month: required(sheetNumber(row[2]), 'ad spend this month'),
    ytd: required(sheetNumber(row[3]), 'ad spend year to date'),
    lastYear: required(sheetNumber(row[4]), 'ad spend last year'),
  }));

  const budgetRows = section(summary, 'เทียบงบทั้งปี');
  const budgets = budgetRows.map(row => ({
    business: text(row[0]),
    budget: required(sheetNumber(row[1]), 'budget'),
    used: required(sheetNumber(row[2]), 'budget used'),
    usedPct: required(sheetNumber(row[3]), 'budget used %'),
    left: required(sheetNumber(row[5]), 'budget left'),
    lastYear: required(sheetNumber(row[6]), 'last year spend'),
  }));
  const yearPct = required(sheetNumber(budgetRows[0][4]), 'year elapsed %');

  const monthly = new Map<string, (number | null)[]>();
  const sources = new Map<string, { from: number; to: number; text: string }[]>();
  for (const row of salesByMonth.slice(1)) {
    const match = /^(\d{4})-(\d{2})$/.exec(text(row[0]));
    const amount = sheetNumber(row[2]);
    if (!match || Number(match[1]) !== year || !Number.isFinite(amount)) continue;
    const business = text(row[1]);
    const months = monthly.get(business) ?? Array<number | null>(12).fill(null);
    months[Number(match[2]) - 1] = amount;
    const source = text(row[3]);
    if (source) {
      const runs = sources.get(business) ?? [];
      const month = Number(match[2]);
      const last = runs[runs.length - 1];
      if (last && last.text === source && last.to === month - 1) last.to = month;
      else runs.push({ from: month, to: month, text: source });
      sources.set(business, runs);
    }
    monthly.set(business, months);
  }

  const sales = section(summary, 'ยอดขายปีนี้').map(row => {
    const business = text(row[0]);
    const adPct = sheetNumber(row[5]);
    return {
      business,
      target: required(sheetNumber(row[1]), 'sales target'),
      sold: required(sheetNumber(row[2]), 'sales so far'),
      adPctOfSales: Number.isFinite(adPct) ? adPct : null,
      soldThisMonth: required(sheetNumber(row[6]), 'sales this month'),
      monthly: monthly.get(business) ?? Array<number | null>(12).fill(null),
      sources: sources.get(business) ?? [],
    };
  });

  const compareThroughMonth = monthlyAds.length > 1 ? lastCompleteMonth(dataThrough) : 0;
  return {
    month: labelled(summary, 'เดือนนี้'), dataThrough, updatedAt: labelled(summary, 'อัปเดตเมื่อ'),
    year, yearPct, adSpend, budgets, sales,
    accounts: parseAccounts(settings),
    sourceNote: summary.map(row => text(row[0])).find(cell => cell.startsWith('ที่มา')) ?? null,
    compareThroughMonth,
    adCompare: compareThroughMonth ? compareAdSpend(monthlyAds, adSpend, year, compareThroughMonth) : [],
    adsSource: 'sheet', adsThrough: dataThrough, adsYearPct: yearPct,
  };
}

/** Monthly ad spend of one business on one channel, as pulled from Windsor into the site's database. */
export interface SpendRow { business: string; channel: string; month: string; spend: number }

const SPEND_BUSINESSES = ['GFS B2B', 'GFS B2C', 'MHL อาคาร', 'MHL CAR'];
const BASE_CHANNELS = ['Facebook Ads', 'Google Ads'];

/** Share of the year elapsed at the end of `isoDate`. */
function yearElapsed(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const day = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000 + 1;
  return day / ((Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86_400_000);
}

/**
 * Replaces the sheet's ad-spend figures with the site's own Windsor pulls (the sheet's feed stopped
 * on 30 Oct 2026). Targets, budgets and sales stay from the sheet. Spend through `adsThrough`;
 * budget groups are matched by name, "GFS (B2B+B2C)" summing both GFS businesses. Channels other
 * than Facebook and Google (e.g. ChatGPT Ads) are listed only where they have spend.
 */
export function withWindsorSpend(stats: CompanyStats, rows: SpendRow[], adsThrough: string): CompanyStats {
  const year = Number(adsThrough.slice(0, 4));
  const thisMonth = adsThrough.slice(0, 7);
  const through = lastCompleteMonth(adsThrough);
  const extra = [...new Set(rows.filter(row => row.spend && !BASE_CHANNELS.includes(row.channel)).map(row => row.channel))].sort();
  const channels = [...BASE_CHANNELS, ...extra];

  const sum = (business: string, channel: string, keep: (rowYear: number, rowMonth: number) => boolean) =>
    rows.reduce((total, row) => {
      if (row.business !== business || row.channel !== channel || row.month > thisMonth) return total;
      return keep(Number(row.month.slice(0, 4)), Number(row.month.slice(5, 7))) ? total + row.spend : total;
    }, 0);

  const adSpend: AdSpendRow[] = [];
  const adCompare: AdCompareRow[] = [];
  for (const business of SPEND_BUSINESSES) {
    for (const channel of channels) {
      const ytd = sum(business, channel, y => y === year);
      const lastYear = sum(business, channel, y => y === year - 1);
      if (extra.includes(channel) && !ytd && !lastYear) continue;
      adSpend.push({ business, channel, month: sum(business, channel, (y, m) => y === year && m === Number(thisMonth.slice(5))), ytd, lastYear });
      adCompare.push({
        business, channel,
        thisYear: sum(business, channel, (y, m) => y === year && m <= through),
        lastYear: sum(business, channel, (y, m) => y === year - 1 && m <= through),
      });
    }
  }

  const members = (group: string) => (group.startsWith('GFS') ? ['GFS B2B', 'GFS B2C'] : [group]);
  const budgets = stats.budgets.map(budget => {
    const own = adSpend.filter(row => members(budget.business).includes(row.business));
    const used = own.reduce((total, row) => total + row.ytd, 0);
    return {
      ...budget, used, usedPct: budget.budget ? used / budget.budget : 0, left: budget.budget - used,
      lastYear: own.reduce((total, row) => total + row.lastYear, 0),
    };
  });

  return {
    ...stats, adSpend, budgets, compareThroughMonth: through, adCompare,
    adsSource: 'windsor', adsThrough, adsYearPct: yearElapsed(adsThrough),
  };
}

// How each business on the tree is named in the sheet. GFS has one sales target and one ad
// budget for B2B and B2C together (approved: not split), while ad spend is split by campaign.
const SHEET_NAMES: Record<BusinessKey, { sales: string; budget: string; spend: string }> = {
  b2b: { sales: 'GFS', budget: 'GFS (B2B+B2C)', spend: 'GFS B2B' },
  b2c: { sales: 'GFS', budget: 'GFS (B2B+B2C)', spend: 'GFS B2C' },
  mhl: { sales: 'MHL อาคาร', budget: 'MHL อาคาร', spend: 'MHL อาคาร' },
  car: { sales: 'MHL CAR', budget: 'MHL CAR', spend: 'MHL CAR' },
};

export interface BusinessFigures {
  /** True for GFS B2B/B2C, whose target and budget are the shared GFS figures. */
  sharedGfs: boolean;
  sales?: SalesRow; budget?: BudgetRow;
  /** Ad spend so far this year for this business only (all channels). */
  spentYtd: number; spentByChannel: AdSpendRow[];
  accounts: AdAccount[];
}

export function businessFigures(stats: CompanyStats, key: BusinessKey): BusinessFigures {
  const names = SHEET_NAMES[key];
  const spentByChannel = stats.adSpend.filter(row => row.business === names.spend);
  return {
    sharedGfs: key === 'b2b' || key === 'b2c',
    sales: stats.sales.find(row => row.business === names.sales),
    budget: stats.budgets.find(row => row.business === names.budget),
    spentYtd: spentByChannel.reduce((sum, row) => sum + row.ytd, 0),
    spentByChannel,
    accounts: stats.accounts.filter(account => account.business.split('/').map(part => part.trim()).includes(names.spend)),
  };
}

/** Days from the day after `dataThrough` to 31 Dec (at least 1). */
export function daysLeftInYear(dataThrough: string): number {
  const [y, m, d] = dataThrough.split('-').map(Number);
  const days = Math.round((Date.UTC(y, 11, 31) - Date.UTC(y, m - 1, d)) / 86_400_000);
  return Math.max(1, days);
}
