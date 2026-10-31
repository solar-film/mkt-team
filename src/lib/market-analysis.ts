// Comparisons and plain rule-based findings for the ข้อมูลตลาด pages. Pure functions so tests can pin them.
import {
  change, costPerResult, daysInMonth, emptyMetrics, addMetrics, monthLabel, PLATFORM_INFO, results, shiftMonth, sumMetrics,
  type Brand, type CampaignRow, type DayRow, type KeywordKind, type KeywordRow, type KeywordStat, type MarketData, type Metrics,
  type MonthRow, type Platform,
} from './ads-data';

export interface Filter { platform?: Platform; brand: Brand | 'all' }

const matches = (row: { platform: Platform; brand: Brand }, f: Filter) =>
  (!f.platform || row.platform === f.platform) && (f.brand === 'all' || row.brand === f.brand);

/** Last day of `month` the comparison runs to: the whole month, or up to today while it is still running. */
export function cutoffDay(month: string, today: string): number {
  return month === today.slice(0, 7) ? Number(today.slice(8, 10)) : daysInMonth(month);
}

function sumDays(days: DayRow[], f: Filter, month: string, lastDay: number): Metrics {
  return sumMetrics(days.filter(d => matches(d, f) && d.date.startsWith(month) && Number(d.date.slice(8, 10)) <= lastDay));
}

export interface Comparison {
  current: Metrics;
  prevMonth: Metrics;
  lastYear: Metrics;
  /** Day of month all three are cut at when the selected month is still running; null for a finished month. */
  partialDay: number | null;
  ytd: Metrics;
  ytdLastYear: Metrics;
}

/**
 * Month vs the month before and the same month last year, always over the same days
 * (1..today while the month runs), and January..this month vs the same span last year.
 */
export function compare(data: MarketData, f: Filter): Comparison {
  const { month, today } = data;
  const cut = cutoffDay(month, today);
  const partialDay = month === today.slice(0, 7) ? cut : null;
  const prev = shiftMonth(month, -1);
  const lastYearMonth = shiftMonth(month, -12);
  const current = sumDays(data.days, f, month, cut);
  const prevMonth = sumDays(data.days, f, prev, Math.min(cut, daysInMonth(prev)));
  const lastYear = sumDays(data.days, f, lastYearMonth, Math.min(cut, daysInMonth(lastYearMonth)));

  const year = month.slice(0, 4);
  const lastYearKey = String(Number(year) - 1);
  const before = (rows: MonthRow[], y: string) => sumMetrics(rows.filter(r => matches(r, f) && r.month >= `${y}-01` && r.month < `${y}${month.slice(4)}`));
  const ytd = addMetrics(before(data.months, year), current);
  const ytdLastYear = addMetrics(before(data.months, lastYearKey), lastYear);
  return { current, prevMonth, lastYear, partialDay, ytd, ytdLastYear };
}

export interface YearBar { monthNumber: number; thisYear: number | null; lastYear: number | null }

/** Spend Jan..Dec for the selected year and the year before (null where there is no row yet). */
export function spendByMonth(data: MarketData, f: Filter): YearBar[] {
  const year = Number(data.month.slice(0, 4));
  const total = (month: string) => {
    const rows = data.months.filter(r => matches(r, f) && r.month === month);
    return rows.length ? sumMetrics(rows).spend : null;
  };
  return Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, '0');
    return { monthNumber: i + 1, thisYear: total(`${year}-${mm}`), lastYear: total(`${year - 1}-${mm}`) };
  });
}

export interface DailyPoint { day: number; spend: number; results: number }

export function dailySeries(data: MarketData, f: Filter): DailyPoint[] {
  const days = daysInMonth(data.month);
  const byDay = new Map<number, Metrics>();
  for (const d of data.days) {
    if (!matches(d, f) || !d.date.startsWith(data.month)) continue;
    const day = Number(d.date.slice(8, 10));
    byDay.set(day, addMetrics(byDay.get(day) ?? emptyMetrics(), d));
  }
  const last = cutoffDay(data.month, data.today);
  return Array.from({ length: Math.min(days, last) }, (_, i) => {
    const m = byDay.get(i + 1) ?? emptyMetrics();
    return { day: i + 1, spend: m.spend, results: results(m) };
  });
}

export interface CampaignLine extends Metrics {
  key: string; platform: Platform; brand: Brand; accountName: string; campaignName: string; prevSpend: number; prevResults: number;
}

/** Campaigns of the selected month, with last month's spend and results beside them; biggest spend first. */
export function campaignLines(data: MarketData, f: Filter): CampaignLine[] {
  const prev = shiftMonth(data.month, -1);
  const lines = new Map<string, CampaignLine>();
  const keyOf = (c: CampaignRow) => `${c.platform}|${c.accountName}|${c.campaignId}`;
  for (const c of data.campaigns) {
    if (!matches(c, f) || c.month !== data.month) continue;
    const key = keyOf(c);
    const line = lines.get(key) ?? { key, platform: c.platform, brand: c.brand, accountName: c.accountName, campaignName: c.campaignName, prevSpend: 0, prevResults: 0, ...emptyMetrics() };
    lines.set(key, addMetrics(line, c) as CampaignLine);
  }
  for (const c of data.campaigns) {
    if (!matches(c, f) || c.month !== prev) continue;
    const line = lines.get(keyOf(c));
    if (line) { line.prevSpend += c.spend; line.prevResults += results(c); }
  }
  return [...lines.values()].sort((a, b) => b.spend - a.spend);
}

export interface KeywordLine extends KeywordStat { brand: Brand; prevSpend: number | null }

/** Selected month's keywords (or search terms) for the brand filter, with last month's spend; biggest spend first. */
export function keywordLines(data: MarketData, f: Filter, kind: KeywordKind): KeywordLine[] {
  const prev = shiftMonth(data.month, -1);
  const keyOf = (k: KeywordRow) => `${k.accountId}|${k.text}|${k.matchType}`;
  const inBrand = (k: KeywordRow) => k.kind === kind && (f.brand === 'all' || k.brand === f.brand);
  const before = new Map(data.keywords.filter(k => inBrand(k) && k.month === prev).map(k => [keyOf(k), k.spend]));
  return data.keywords
    .filter(k => inBrand(k) && k.month === data.month)
    .map(k => ({ ...k, prevSpend: before.get(keyOf(k)) ?? null }))
    .sort((a, b) => b.spend - a.spend);
}

export interface Breakdown extends Metrics { label: string; prevSpend: number }

/** Selected month split by platform or by brand, with the month before for context. */
export function breakdown(data: MarketData, f: Filter, by: 'platform' | 'brand'): Breakdown[] {
  const prev = shiftMonth(data.month, -1);
  const groups = new Map<string, Breakdown>();
  for (const r of data.months) {
    if (!matches(r, f) || (r.month !== data.month && r.month !== prev)) continue;
    const label = by === 'platform' ? PLATFORM_INFO[r.platform].label : r.brand;
    const group = groups.get(label) ?? { label, prevSpend: 0, ...emptyMetrics() };
    if (r.month === data.month) addMetrics(group, r); else group.prevSpend += r.spend;
    groups.set(label, group);
  }
  return [...groups.values()].filter(g => g.spend > 0 || g.prevSpend > 0).sort((a, b) => b.spend - a.spend);
}

// ---------- findings ----------

export interface Finding { tone: 'good' | 'warn' | 'info'; title: string; detail: string }

const baht = (n: number) => `฿${Math.round(n).toLocaleString('th-TH')}`;
const pct = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 100)}%`;
// Below this spend a campaign's cost per result is too noisy to call out.
export const MIN_CAMPAIGN_SPEND = 1000;
const NOTABLE_CHANGE = 0.2;

/** Rules, not AI: every finding states the figures it comes from so the team can check it. */
export function findings(data: MarketData, f: Filter): Finding[] {
  const out: Finding[] = [];
  const c = compare(data, f);
  const span = c.partialDay ? ` (1–${c.partialDay} ${monthLabel(data.month)} เทียบช่วงวันเดียวกัน)` : '';

  const spendMoM = change(c.current.spend, c.prevMonth.spend);
  if (spendMoM !== null && Math.abs(spendMoM) >= NOTABLE_CHANGE) {
    out.push({ tone: 'info', title: `ค่าโฆษณา${spendMoM > 0 ? 'เพิ่มขึ้น' : 'ลดลง'} ${pct(spendMoM)} จากเดือนก่อน`, detail: `${baht(c.current.spend)} เทียบ ${baht(c.prevMonth.spend)}${span}` });
  }
  const cprNow = costPerResult(c.current);
  const cprPrev = costPerResult(c.prevMonth);
  const cprMoM = change(cprNow, cprPrev);
  if (cprNow !== null && cprPrev !== null && cprMoM !== null && Math.abs(cprMoM) >= NOTABLE_CHANGE) {
    out.push({
      tone: cprMoM > 0 ? 'warn' : 'good',
      title: `ต้นทุนต่อผลลัพธ์${cprMoM > 0 ? 'แพงขึ้น' : 'ถูกลง'} ${pct(cprMoM)} จากเดือนก่อน`,
      detail: `${baht(cprNow)} เทียบ ${baht(cprPrev)} ต่อผลลัพธ์${span}`,
    });
  }
  const spendYoY = change(c.current.spend, c.lastYear.spend);
  if (spendYoY !== null) {
    out.push({ tone: 'info', title: `เทียบเดือนเดียวกันปีก่อน ค่าโฆษณา ${pct(spendYoY)}`, detail: `${baht(c.current.spend)} เทียบ ${baht(c.lastYear.spend)} (${monthLabel(shiftMonth(data.month, -12))})${span}` });
  }

  if (c.partialDay && c.partialDay < daysInMonth(data.month) && c.current.spend > 0) {
    const projected = (c.current.spend / c.partialDay) * daysInMonth(data.month);
    out.push({ tone: 'info', title: `ถ้าใช้จ่ายเท่าเดิมทุกวัน สิ้นเดือนจะใช้ราว ${baht(projected)}`, detail: `ใช้ไปแล้ว ${baht(c.current.spend)} ใน ${c.partialDay} วัน (เฉลี่ยวันละ ${baht(c.current.spend / c.partialDay)})` });
  }

  const lines = campaignLines(data, f);
  const sizable = lines.filter(l => l.spend >= MIN_CAMPAIGN_SPEND);
  for (const l of sizable.filter(l => results(l) === 0).slice(0, 5)) {
    out.push({ tone: 'warn', title: `แคมเปญใช้เงินแต่ยังไม่มีผลลัพธ์: ${l.campaignName}`, detail: `${PLATFORM_INFO[l.platform].label} · ${l.accountName} · ใช้ ${baht(l.spend)} ไม่มีลีด/แชท/Conversion (บางแคมเปญตั้งใจทำยอดเห็น/ผู้ติดตาม)` });
  }
  const ranked = sizable.filter(l => results(l) > 0).sort((a, b) => costPerResult(a)! - costPerResult(b)!);
  if (ranked.length >= 2) {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    out.push({ tone: 'good', title: `ต้นทุนต่อผลลัพธ์ดีที่สุด: ${best.campaignName}`, detail: `${PLATFORM_INFO[best.platform].label} · ${baht(costPerResult(best)!)} ต่อผลลัพธ์ (${Math.round(results(best)).toLocaleString('th-TH')} ผลลัพธ์ จาก ${baht(best.spend)})` });
    out.push({ tone: 'warn', title: `ต้นทุนต่อผลลัพธ์สูงที่สุด: ${worst.campaignName}`, detail: `${PLATFORM_INFO[worst.platform].label} · ${baht(costPerResult(worst)!)} ต่อผลลัพธ์ (${Math.round(results(worst)).toLocaleString('th-TH')} ผลลัพธ์ จาก ${baht(worst.spend)})` });
  }

  if (!f.platform) {
    const parts = breakdown(data, f, 'platform').filter(p => p.spend > 0);
    const total = parts.reduce((sum, p) => sum + p.spend, 0);
    if (parts.length > 1 && total > 0) {
      out.push({ tone: 'info', title: 'สัดส่วนค่าโฆษณาตามช่องทาง', detail: parts.map(p => `${p.label} ${Math.round((p.spend / total) * 100)}%`).join(' · ') });
    }
  }
  return out;
}
