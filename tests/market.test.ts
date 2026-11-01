import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brandOf, costPerResult, daysInMonth, emptyMetrics, KEYWORDS_KEPT_PER_ACCOUNT, monthLabel, normalizeKeywordRows, normalizeWindsorRows, shiftMonth, type DayRow, type KeywordRow, type MarketData, type MonthRow, type CampaignRow } from '../src/lib/ads-data';
import { campaignLines, compare, cutoffDay, findings, keywordLines, spendByMonth } from '../src/lib/market-analysis';

// Made-up accounts and figures; real numbers never enter this public repository.

test('brand comes from the ad account name', () => {
  assert.equal(brandOf('ExampleCAR'), 'MHL CAR');
  assert.equal(brandOf('MAHOLAN Example'), 'MHL');
  assert.equal(brandOf('Goodfilm Example Ads'), 'GFS');
  assert.equal(brandOf('Someone else'), 'อื่น ๆ');
});

test('month helpers cross year ends and use the Buddhist year', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-10', -12), '2025-10');
  assert.equal(daysInMonth('2028-02'), 29);
  assert.equal(monthLabel('2026-10'), 'ต.ค. 69');
});

test('Windsor rows are merged per campaign-day, leads and chats counted, empty days dropped', () => {
  const rows = normalizeWindsorRows('facebook', [
    { date: '2026-10-01', account_id: 'a1', account_name: 'ExampleCAR', account_currency: 'THB', campaign_id: 'c1', campaign: 'MSG', spend: 100, impressions: 1000, clicks: 10, actions_lead: 1, actions_onsite_conversion_messaging_conversation_started_7d: 2 },
    { date: '2026-10-01', account_id: 'a1', account_name: 'ExampleCAR', campaign_id: 'c1', campaign: 'MSG', spend: '50.5', impressions: 500, clicks: 5, actions_lead: null, actions_onsite_conversion_messaging_conversation_started_7d: 1 },
    { date: '2026-10-02', account_id: 'a1', account_name: 'ExampleCAR', campaign_id: 'c2', campaign: 'Paused', spend: 0, impressions: 0, clicks: 0 },
    { date: 'not a date', spend: 99 },
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual({ spend: rows[0].spend, impressions: rows[0].impressions, leads: rows[0].leads, messages: rows[0].messages, currency: rows[0].currency },
    { spend: 150.5, impressions: 1500, leads: 1, messages: 3, currency: 'THB' });
  assert.throws(() => normalizeWindsorRows('facebook', { error: 'x' }), /no data array/);
});

const day = (platform: DayRow['platform'], date: string, spend: number, leads = 0): DayRow =>
  ({ platform, brand: 'GFS', date, ...emptyMetrics(), spend, leads, clicks: spend / 10, impressions: spend * 10 });

function sample(today: string): MarketData {
  const days: DayRow[] = [];
  for (let d = 1; d <= 31; d++) {
    const dd = String(d).padStart(2, '0');
    days.push(day('facebook', `2026-10-${dd}`, 100, 1));
    if (d <= 30) days.push(day('facebook', `2026-09-${dd}`, 50, 1));
    days.push(day('facebook', `2025-10-${dd}`, 200, 1));
  }
  const months: MonthRow[] = [
    { platform: 'facebook', brand: 'GFS', month: '2026-01', ...emptyMetrics(), spend: 1000 },
    { platform: 'facebook', brand: 'GFS', month: '2025-01', ...emptyMetrics(), spend: 4000 },
    { platform: 'facebook', brand: 'GFS', month: '2026-10', ...emptyMetrics(), spend: 3100 },
  ];
  const campaigns: CampaignRow[] = [
    { platform: 'facebook', brand: 'GFS', accountName: 'Goodfilm X', campaignId: 'c1', campaignName: 'Leads', month: '2026-10', ...emptyMetrics(), spend: 3000, leads: 30 },
    { platform: 'facebook', brand: 'GFS', accountName: 'Goodfilm X', campaignId: 'c2', campaignName: 'Awareness', month: '2026-10', ...emptyMetrics(), spend: 1500 },
    { platform: 'facebook', brand: 'GFS', accountName: 'Goodfilm X', campaignId: 'c1', campaignName: 'Leads', month: '2026-09', ...emptyMetrics(), spend: 900, leads: 3 },
  ];
  const keywords: KeywordRow[] = [
    { kind: 'keyword', month: '2026-10', accountId: 'g1', accountName: 'Goodfilm G', brand: 'GFS', text: 'ฟิล์มอาคาร', matchType: 'EXACT', spend: 500, impressions: 100, clicks: 10, conversions: 5 },
    { kind: 'keyword', month: '2026-10', accountId: 'g2', accountName: 'Maholan G', brand: 'MHL', text: 'ติดฟิล์มบ้าน', matchType: 'BROAD', spend: 900, impressions: 300, clicks: 20, conversions: 2 },
    { kind: 'keyword', month: '2026-09', accountId: 'g1', accountName: 'Goodfilm G', brand: 'GFS', text: 'ฟิล์มอาคาร', matchType: 'EXACT', spend: 400, impressions: 80, clicks: 8, conversions: 4 },
    { kind: 'search_term', month: '2026-10', accountId: 'g1', accountName: 'Goodfilm G', brand: 'GFS', text: 'ฟิล์ม 3m', matchType: '', spend: 50, impressions: 10, clicks: 1, conversions: 0 },
  ];
  return { configured: true, month: '2026-10', today, firstMonth: '2025-01', months, campaigns, days, keywords, sync: [] };
}

test('a running month is compared over the same days of the month before and last year', () => {
  const c = compare(sample('2026-10-15'), { brand: 'all' });
  assert.equal(c.partialDay, 15);
  assert.equal(c.current.spend, 1500);
  assert.equal(c.prevMonth.spend, 750);
  assert.equal(c.lastYear.spend, 3000);
  // Jan..Sep from monthly totals plus 1..15 Oct.
  assert.equal(c.ytd.spend, 1000 + 1500);
  assert.equal(c.ytdLastYear.spend, 4000 + 3000);
});

test('a finished month uses whole months', () => {
  assert.equal(cutoffDay('2026-09', '2026-10-15'), 30);
  const c = compare(sample('2026-11-02'), { brand: 'all' });
  assert.equal(c.partialDay, null);
  assert.equal(c.current.spend, 3100);
  assert.equal(c.prevMonth.spend, 1500);
});

test('brand and platform filters exclude other rows', () => {
  assert.equal(compare(sample('2026-10-15'), { brand: 'MHL' }).current.spend, 0);
  assert.equal(compare(sample('2026-10-15'), { brand: 'all', platform: 'google_ads' }).current.spend, 0);
});

test('year chart leaves months without data empty instead of zero', () => {
  const bars = spendByMonth(sample('2026-10-15'), { brand: 'all' });
  assert.equal(bars[0].thisYear, 1000);
  assert.equal(bars[1].thisYear, null);
  assert.equal(bars[9].lastYear, null);
});

test('campaign lines carry last month and findings flag spend without results', () => {
  const data = sample('2026-10-15');
  const lines = campaignLines(data, { brand: 'all' });
  assert.equal(lines[0].campaignName, 'Leads');
  assert.equal(lines[0].prevSpend, 900);
  assert.equal(costPerResult(lines[0]), 100);
  const titles = findings(data, { brand: 'all' }).map(f => f.title);
  assert.ok(titles.some(t => t.includes('ยังไม่มีผลลัพธ์') && t.includes('Awareness')));
  assert.ok(titles.some(t => t.startsWith('ค่าโฆษณาเพิ่มขึ้น +100%')));
  const all = findings(data, { brand: 'all' });
  assert.deepEqual(all.find(f => f.label === 'ค่าโฆษณา เทียบเดือนก่อน')?.value, '+100%');
  assert.equal(all.find(f => f.kind === 'campaign' && f.tone === 'warn' && f.label === 'ใช้เงินแต่ยังไม่มีผลลัพธ์')?.campaign, 'Awareness');
});

test('keyword rows merge per account, text and match type, and keep the biggest spenders per account', () => {
  const many = Array.from({ length: KEYWORDS_KEPT_PER_ACCOUNT + 5 }, (_, i) => ({ account_id: 'a', account_name: 'Goodfilm G', keyword_text: `k${i}`, keyword_match_type: 'BROAD', spend: i + 1, impressions: 1, clicks: 0, conversions: 0 }));
  const rows = normalizeKeywordRows('keyword', [
    ...many,
    { account_id: 'a', account_name: 'Goodfilm G', keyword_text: 'k0', keyword_match_type: 'BROAD', spend: 1000, impressions: 5, clicks: 2, conversions: '1.5' },
    { account_id: 'b', account_name: 'Maholan G', keyword_text: '', spend: 99, impressions: 9 },
    { account_id: 'b', account_name: 'Maholan G', keyword_text: 'idle', spend: 0, impressions: 0 },
  ]);
  assert.equal(rows.length, KEYWORDS_KEPT_PER_ACCOUNT);
  assert.deepEqual(rows[0], { kind: 'keyword', accountId: 'a', accountName: 'Goodfilm G', text: 'k0', matchType: 'BROAD', spend: 1001, impressions: 6, clicks: 2, conversions: 1.5 });
  const terms = normalizeKeywordRows('search_term', [{ account_id: 'a', search_term: 'ฟิล์ม', spend: 5, impressions: 1 }]);
  assert.equal(terms[0].matchType, '');
});

test('keyword lines follow the brand filter and carry last month spend', () => {
  const data = sample('2026-10-15');
  const all = keywordLines(data, { brand: 'all' }, 'keyword');
  assert.deepEqual(all.map(k => k.text), ['ติดฟิล์มบ้าน', 'ฟิล์มอาคาร']);
  assert.equal(all[1].prevSpend, 400);
  assert.equal(all[0].prevSpend, null);
  assert.deepEqual(keywordLines(data, { brand: 'GFS' }, 'keyword').map(k => k.text), ['ฟิล์มอาคาร']);
  assert.equal(keywordLines(data, { brand: 'all' }, 'search_term').length, 1);
});
