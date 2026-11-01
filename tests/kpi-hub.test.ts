import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KPI_HUB_SECONDS, httpsUrl, issuePass, kpiHubLinks, passValid, passwordMatches } from '../src/lib/kpi-hub';
import { readCookie } from '../src/lib/member-auth';

const NOW = Date.UTC(2026, 10, 1);

test('password must match exactly and an unset password never matches', () => {
  assert.equal(passwordMatches('secret', 'secret'), true);
  assert.equal(passwordMatches('Secret', 'secret'), false);
  assert.equal(passwordMatches('secret ', 'secret'), false);
  assert.equal(passwordMatches('', ''), false);
});

test('pass opens the page for its own member for 7 days', () => {
  const pass = issuePass('m1', 'secret', NOW);
  assert.equal(passValid(pass, 'm1', 'secret', NOW), true);
  assert.equal(passValid(pass, 'm1', 'secret', NOW + KPI_HUB_SECONDS * 1000 - 1000), true);
  assert.equal(passValid(pass, 'm1', 'secret', NOW + KPI_HUB_SECONDS * 1000), false, 'expired');
  assert.equal(passValid(pass, 'm2', 'secret', NOW), false, 'another member');
  assert.equal(passValid(pass, 'm1', 'changed', NOW), false, 'password changed');
});

test('forged or malformed passes are refused', () => {
  const [, sig] = issuePass('m1', 'secret', NOW).split('_');
  const later = Math.floor(NOW / 1000) + KPI_HUB_SECONDS * 10;
  assert.equal(passValid(`${later}_${sig}`, 'm1', 'secret', NOW), false, 'extended expiry');
  for (const bad of [null, '', '_abc', 'abc_def', `${later}`]) assert.equal(passValid(bad, 'm1', 'secret', NOW), false);
});

test('pass survives the cookie format check', () => {
  const pass = issuePass('m1', 'secret', NOW);
  const request = new Request('https://x.test/api/kpi-hub', { headers: { cookie: `mkt_kpi_hub=${pass}` } });
  assert.equal(readCookie(request, 'mkt_kpi_hub'), pass);
});

test('links accept https only and are empty when unset', () => {
  assert.equal(httpsUrl('javascript:alert(1)'), null);
  assert.equal(httpsUrl('http://example.com'), null);
  assert.equal(httpsUrl(' https://example.com/a '), 'https://example.com/a');
  assert.deepEqual(kpiHubLinks({}), { sheetUrl: null, dashboardUrl: null });
});

test('no password, sheet id, or money wording in the page code (public repository)', () => {
  const files = ['src/lib/kpi-hub.ts', 'src/app/kpi-hub/page.tsx', 'src/app/api/kpi-hub/route.ts'];
  const text = files.map(file => readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(text, /spreadsheets\/d\//, 'sheet id');
  assert.doesNotMatch(text, /ราคา|ต้นทุน|งบ|ยอดขาย|฿|บาท/, 'money wording');
});
