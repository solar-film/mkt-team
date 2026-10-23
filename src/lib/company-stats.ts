// Parses the "Good Group · ยอดใช้โฆษณา" summary sheet that มะลิ rewrites every morning.
// The numbers are confidential: they are only ever served by the admin-only API and are
// never stored in this (public) repository. Sections are found by their header labels, not
// fixed row numbers, so small layout edits in the sheet do not shift the data.

export interface AdSpendRow { business: string; channel: string; month: number; ytd: number; lastYear: number }
export interface BudgetRow { business: string; budget: number; used: number; usedPct: number; left: number; lastYear: number }
export interface SalesRow {
  business: string; target: number; sold: number; adPctOfSales: number | null; soldThisMonth: number;
  /** Jan..Dec of the data year; null where the sheet has no figure yet. */
  monthly: (number | null)[];
}
export interface CompanyStats {
  month: string; dataThrough: string; updatedAt: string; year: number;
  /** Share of the year elapsed, 0..1, as stated by the sheet. */
  yearPct: number;
  adSpend: AdSpendRow[]; budgets: BudgetRow[]; sales: SalesRow[];
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

export function parseCompanyStats(summary: Rows, salesByMonth: Rows): CompanyStats {
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
  for (const row of salesByMonth.slice(1)) {
    const match = /^(\d{4})-(\d{2})$/.exec(text(row[0]));
    const amount = sheetNumber(row[2]);
    if (!match || Number(match[1]) !== year || !Number.isFinite(amount)) continue;
    const business = text(row[1]);
    const months = monthly.get(business) ?? Array<number | null>(12).fill(null);
    months[Number(match[2]) - 1] = amount;
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
    };
  });

  return {
    month: labelled(summary, 'เดือนนี้'), dataThrough, updatedAt: labelled(summary, 'อัปเดตเมื่อ'),
    year, yearPct, adSpend, budgets, sales,
  };
}

/** Days from the day after `dataThrough` to 31 Dec (at least 1). */
export function daysLeftInYear(dataThrough: string): number {
  const [y, m, d] = dataThrough.split('-').map(Number);
  const days = Math.round((Date.UTC(y, 11, 31) - Date.UTC(y, m - 1, d)) / 86_400_000);
  return Math.max(1, days);
}
