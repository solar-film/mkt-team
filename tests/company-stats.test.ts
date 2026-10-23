import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { CompanyStatsFormatError, daysLeftInYear, parseCompanyStats, sheetNumber } from '../src/lib/company-stats';

const require = createRequire(import.meta.url);
const json = (value: unknown) => JSON.stringify(value);

// Made-up figures in the sheet's layout; real numbers never enter this public repository.
const SUMMARY = [
  ['Good Group · ยอดใช้โฆษณา'],
  ['เดือนนี้', '2026-10', 'ข้อมูลถึงวันที่', '2026-10-22', 'อัปเดตเมื่อ', '2026-10-23 07:25'],
  [],
  ['ธุรกิจ', 'ช่องทาง', 'ใช้เดือนนี้ (บาท)', 'ใช้สะสมทั้งปี (บาท)', 'ปีที่แล้วทั้งปี (บาท)'],
  ['Biz A', 'Facebook Ads', '1,000', '10,000', '20,000'],
  ['Biz A', 'Google Ads', '0', '0', '0'],
  [],
  ['เทียบงบทั้งปี', 'งบทั้งปี (บาท)', 'ใช้สะสม (บาท)', '% ใช้แล้ว', '% ของปีที่ผ่านไป', 'เหลือ (บาท)', 'ปีที่แล้วทั้งปี (บาท)'],
  ['Biz A', '100,000', '10,000', '10.0%', '80.8%', '90,000', '20,000'],
  [],
  ['ยอดขายปีนี้', 'เป้าทั้งปี (บาท)', 'ขายได้สะสม (บาท)', '% ถึงเป้า', '% ของปีที่ผ่านไป', 'ค่าโฆษณา % ของยอดขาย', 'ขายได้เดือนนี้ (บาท)'],
  ['Biz A', '1,200,000', '600,000', '50.0%', '80.8%', '1.7%', '50,000'],
];
const SALES = [
  ['เดือน', 'ธุรกิจ', 'ยอดขาย (บาท · ไม่รวม VAT)', 'ที่มา'],
  ['2026-01', 'Biz A', '100,000.50', 'x'],
  ['2026-10', 'Biz A', '50,000', 'x'],
  ['2025-12', 'Biz A', '999', 'other year is ignored'],
];

test('sheet numbers accept commas and percentages', () => {
  assert.equal(sheetNumber('1,234,567'), 1234567);
  assert.equal(sheetNumber('12.3%'), 0.123);
  assert.ok(Number.isNaN(sheetNumber('')));
});

test('summary sections are found by their headers and monthly sales land in their month', () => {
  const stats = parseCompanyStats(SUMMARY, SALES);
  assert.equal(stats.dataThrough, '2026-10-22');
  assert.equal(stats.year, 2026);
  assert.equal(stats.yearPct, 0.808);
  assert.equal(stats.adSpend.length, 2);
  assert.equal(json(stats.budgets[0]), json({ business: 'Biz A', budget: 100000, used: 10000, usedPct: 0.1, left: 90000, lastYear: 20000 }));
  assert.equal(stats.sales[0].sold, 600000);
  assert.equal(stats.sales[0].adPctOfSales, 0.017);
  assert.equal(stats.sales[0].monthly[0], 100000.5);
  assert.equal(stats.sales[0].monthly[9], 50000);
  assert.equal(stats.sales[0].monthly.filter(v => v != null).length, 2);
});

test('a missing section is reported instead of showing wrong numbers', () => {
  assert.throws(() => parseCompanyStats(SUMMARY.slice(0, 9), SALES), CompanyStatsFormatError);
  assert.throws(() => parseCompanyStats(SUMMARY.map(row => row.map(cell => cell === '10,000' ? 'n/a' : cell)), SALES), CompanyStatsFormatError);
});

test('days left run to 31 December', () => {
  assert.equal(daysLeftInYear('2026-12-30'), 1);
  assert.equal(daysLeftInYear('2026-10-22'), 70);
});

function loadRoute(options: { session: boolean; env: Record<string, string>; sheet: () => Promise<unknown> }) {
  const exports: Record<string, (request: Request) => Promise<Response>> = {};
  const compiled = ts.transpileModule(readFileSync('src/app/api/admin/company-stats/route.ts', 'utf8'), {
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
      if (name === '@/lib/admin-session') return { hasAdminSession: () => options.session };
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
const get = () => new Request('https://app.example/api/admin/company-stats');

test('figures need the admin session and never reach the sheet without it', async () => {
  const { route, requests } = loadRoute({ session: false, env: ENV, sheet: async () => ({ data: {} }) });
  const response = await route.GET(get());
  assert.equal(response.status, 401);
  assert.equal(requests.length, 0);
});

test('admins get parsed figures from the configured sheet, uncached by browsers', async () => {
  const { route, requests } = loadRoute({ session: true, env: ENV, sheet: async () => ({ data: { valueRanges: [{ values: SUMMARY }, { values: SALES }] } }) });
  const response = await route.GET(get());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await response.json()).sales[0].sold, 600000);
  assert.match(requests[0], /spreadsheets\/sheet-id\/values:batchGet\?ranges=/);
});

test('an unshared sheet tells the admin which account to share it with', async () => {
  const { route } = loadRoute({ session: true, env: ENV, sheet: async () => { throw Object.assign(new Error('denied'), { status: 403 }); } });
  const response = await route.GET(get());
  assert.equal(response.status, 503);
  assert.equal(json(await response.json()), json({ error: 'sheet_access', serviceAccount: ENV.GOOGLE_SERVICE_ACCOUNT_EMAIL }));
});

test('missing configuration and changed layouts are reported without details', async () => {
  const unconfigured = loadRoute({ session: true, env: {}, sheet: async () => ({ data: {} }) });
  assert.equal((await (await unconfigured.route.GET(get())).json()).error, 'not_configured');
  const changed = loadRoute({ session: true, env: ENV, sheet: async () => ({ data: { valueRanges: [{ values: [['other']] }, { values: [] }] } }) });
  const response = await changed.route.GET(get());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'sheet_format');
});
