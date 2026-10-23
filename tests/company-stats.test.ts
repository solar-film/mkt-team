import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { businessFigures, CompanyStatsFormatError, daysLeftInYear, parseCompanyStats, sheetNumber } from '../src/lib/company-stats';

const require = createRequire(import.meta.url);
const json = (value: unknown) => JSON.stringify(value);

// Made-up figures and ids in the sheet's layout; real numbers never enter this public repository.
const SUMMARY = [
  ['Good Group · ยอดใช้โฆษณา'],
  ['เดือนนี้', '2026-10', 'ข้อมูลถึงวันที่', '2026-10-22', 'อัปเดตเมื่อ', '2026-10-23 07:25'],
  [],
  ['ธุรกิจ', 'ช่องทาง', 'ใช้เดือนนี้ (บาท)', 'ใช้สะสมทั้งปี (บาท)', 'ปีที่แล้วทั้งปี (บาท)'],
  ['GFS B2B', 'Facebook Ads', '1,000', '10,000', '0'],
  ['GFS B2C', 'Google Ads', '2,000', '30,000', '40,000'],
  ['MHL CAR', 'Facebook Ads', '500', '5,000', '9,000'],
  [],
  ['เทียบงบทั้งปี', 'งบทั้งปี (บาท)', 'ใช้สะสม (บาท)', '% ใช้แล้ว', '% ของปีที่ผ่านไป', 'เหลือ (บาท)', 'ปีที่แล้วทั้งปี (บาท)'],
  ['GFS (B2B+B2C)', '100,000', '40,000', '40.0%', '80.8%', '60,000', '40,000'],
  ['MHL CAR', '20,000', '5,000', '25.0%', '80.8%', '15,000', '9,000'],
  [],
  ['ยอดขายปีนี้', 'เป้าทั้งปี (บาท)', 'ขายได้สะสม (บาท)', '% ถึงเป้า', '% ของปีที่ผ่านไป', 'ค่าโฆษณา % ของยอดขาย', 'ขายได้เดือนนี้ (บาท)'],
  ['GFS', '1,200,000', '600,000', '50.0%', '80.8%', '1.7%', '50,000'],
  ['MHL CAR', '300,000', '100,000', '33.3%', '80.8%', '5.0%', '9,000'],
];
const SALES = [
  ['เดือน', 'ธุรกิจ', 'ยอดขาย (บาท · ไม่รวม VAT)', 'ที่มา'],
  ['2026-01', 'GFS', '100,000.50', 'x'],
  ['2026-10', 'GFS', '50,000', 'x'],
  ['2025-12', 'GFS', '999', 'other year is ignored'],
];
const SETTINGS = [
  ['ช่องทาง', 'รหัสบัญชี', 'ชื่อบัญชี', 'นับเป็นธุรกิจ', 'กติกา'],
  ['Facebook Ads', '111', 'Shop FB', 'GFS B2B / GFS B2C', 'ทีมดูแลเอง'],
  ['Google Ads', '222-333', 'shop.example (ReadyPlanet)', 'GFS B2C', 'คุณมิ้น/ReadyPlanet'],
  ['Facebook Ads', '444', 'Car FB', 'MHL CAR', ''],
  ['Google Ads', '555', 'unused', 'ยังไม่นับ', 'รอยืนยัน'],
  [],
  ['หมายเหตุ'],
];
const MONTHLY = [
  ['เดือน', 'ธุรกิจ', 'ช่องทาง', 'รหัสบัญชี', 'ชื่อบัญชี', 'ยอดใช้ (บาท)'],
  ['2026-01', 'GFS B2C', 'Google Ads', '222-333', 'x', '3,000'],
  ['2026-09', 'GFS B2C', 'Google Ads', '222-333', 'x', '2,000'],
  ['2026-10', 'GFS B2C', 'Google Ads', '222-333', 'x', '9,999'],
  ['2025-02', 'GFS B2C', 'Google Ads', '222-333', 'x', '4,000'],
  ['2025-10', 'GFS B2C', 'Google Ads', '222-333', 'x', '8,888'],
  ['2025-05', 'MHL CAR', 'Facebook Ads', '444', 'x', '1,500'],
];

test('sheet numbers accept commas and percentages', () => {
  assert.equal(sheetNumber('1,234,567'), 1234567);
  assert.equal(sheetNumber('12.3%'), 0.123);
  assert.ok(Number.isNaN(sheetNumber('')));
});

test('summary sections are found by their headers and monthly sales land in their month', () => {
  const stats = parseCompanyStats(SUMMARY, SALES);
  assert.equal(stats.dataThrough, '2026-10-22');
  assert.equal(stats.yearPct, 0.808);
  assert.equal(stats.adSpend.length, 3);
  assert.equal(json(stats.budgets[0]), json({ business: 'GFS (B2B+B2C)', budget: 100000, used: 40000, usedPct: 0.4, left: 60000, lastYear: 40000 }));
  assert.equal(stats.sales[0].monthly[0], 100000.5);
  assert.equal(stats.sales[0].monthly[9], 50000);
  assert.equal(stats.sales[0].monthly.filter(v => v != null).length, 2);
  assert.equal(json(stats.accounts), '[]');
  assert.equal(stats.compareThroughMonth, 0);
});

test('ad accounts come from ตั้งค่า and uncounted accounts are left out', () => {
  const stats = parseCompanyStats(SUMMARY, SALES, SETTINGS, MONTHLY);
  assert.equal(json(stats.accounts.map(a => a.id)), json(['111', '222-333', '444']));
  assert.equal(json(businessFigures(stats, 'b2b').accounts.map(a => a.id)), json(['111']));
  assert.equal(json(businessFigures(stats, 'b2c').accounts.map(a => a.id)), json(['111', '222-333']));
});

test('year-on-year uses only months finished in both years', () => {
  const stats = parseCompanyStats(SUMMARY, SALES, SETTINGS, MONTHLY);
  assert.equal(stats.compareThroughMonth, 9); // data reaches 22 Oct, so October is excluded
  const b2c = stats.adCompare.find(row => row.business === 'GFS B2C')!;
  assert.equal(json(b2c), json({ business: 'GFS B2C', channel: 'Google Ads', thisYear: 5000, lastYear: 4000 }));
  const car = stats.adCompare.find(row => row.business === 'MHL CAR')!;
  assert.equal(car.lastYear, 1500);
});

test('GFS B2B and B2C share the GFS target and budget but keep their own spend', () => {
  const stats = parseCompanyStats(SUMMARY, SALES, SETTINGS, MONTHLY);
  const b2b = businessFigures(stats, 'b2b');
  const b2c = businessFigures(stats, 'b2c');
  const car = businessFigures(stats, 'car');
  assert.equal(b2b.sharedGfs, true);
  assert.equal(b2b.sales?.target, 1200000);
  assert.equal(b2c.budget?.budget, 100000);
  assert.equal(b2b.spentYtd, 10000);
  assert.equal(b2c.spentYtd, 30000);
  assert.equal(car.sharedGfs, false);
  assert.equal(car.sales?.target, 300000);
  assert.equal(car.spentYtd, 5000);
  assert.equal(businessFigures(stats, 'mhl').sales, undefined);
});

test('a missing section is reported instead of showing wrong numbers', () => {
  assert.throws(() => parseCompanyStats(SUMMARY.slice(0, 9), SALES), CompanyStatsFormatError);
  assert.throws(() => parseCompanyStats(SUMMARY.map(row => row.map(cell => cell === '10,000' ? 'n/a' : cell)), SALES), CompanyStatsFormatError);
});

test('days left run to 31 December', () => {
  assert.equal(daysLeftInYear('2026-12-30'), 1);
  assert.equal(daysLeftInYear('2026-10-22'), 70);
});

function loadRoute(options: { env: Record<string, string>; sheet: () => Promise<unknown> }) {
  const exports: Record<string, () => Promise<Response>> = {};
  const compiled = ts.transpileModule(readFileSync('src/app/api/company-stats/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const requests: string[] = [];
  vm.runInNewContext(compiled, {
    exports, URL, encodeURIComponent,
    console: { error: () => {}, warn: () => {}, log: () => {} },
    process: { env: options.env },
    require: (name: string) => {
      if (name === 'next/server') return require(name);
      if (name === 'next/cache') return { unstable_cache: (fn: () => unknown) => fn };
      if (name === '@/lib/company-stats') return require('../src/lib/company-stats.ts');
      if (name === 'google-auth-library') {
        return { JWT: class { request(opts: { url: string }) { requests.push(opts.url); return options.sheet(); } } };
      }
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return { route: exports, requests };
}

const ENV = { COMPANY_STATS_SHEET_ID: 'sheet-id', GOOGLE_SERVICE_ACCOUNT_EMAIL: 'bot@example.iam.gserviceaccount.com', GOOGLE_PRIVATE_KEY: 'k' };

test('figures are read from all four sheet tabs and never cached by browsers', async () => {
  const { route, requests } = loadRoute({ env: ENV, sheet: async () => ({ data: { valueRanges: [{ values: SUMMARY }, { values: SALES }, { values: SETTINGS }, { values: MONTHLY }] } }) });
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const body = await response.json();
  assert.equal(body.sales[0].sold, 600000);
  assert.equal(body.accounts.length, 3);
  assert.equal(body.compareThroughMonth, 9);
  assert.match(requests[0], /spreadsheets\/sheet-id\/values:batchGet\?/);
  assert.equal((requests[0].match(/ranges=/g) || []).length, 4);
});

test('sheet problems are reported by code only, without account details', async () => {
  const denied = loadRoute({ env: ENV, sheet: async () => { throw Object.assign(new Error('denied'), { status: 403 }); } });
  const response = await denied.route.GET();
  assert.equal(response.status, 503);
  assert.equal(json(await response.json()), json({ error: 'sheet_access' }));
  const unconfigured = loadRoute({ env: {}, sheet: async () => ({ data: {} }) });
  assert.equal((await (await unconfigured.route.GET()).json()).error, 'not_configured');
  const changed = loadRoute({ env: ENV, sheet: async () => ({ data: { valueRanges: [{ values: [['other']] }, { values: [] }] } }) });
  assert.equal((await (await changed.route.GET()).json()).error, 'sheet_format');
});
