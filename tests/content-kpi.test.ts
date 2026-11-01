import test from 'node:test';
import assert from 'node:assert/strict';
import { contentKpiOptions, isKpiMatchPlatform } from '../src/lib/content-kpi';

const kpis = [
  { id: 'fb', name: 'บทความ 1 โพส /สัปดาห์ (Facebook)', memberId: 'a', month: 11, year: 2026 },
  { id: 'fbReel', name: 'Facebook Reel 2 โพส /สัปดาห์', memberId: 'a', month: 11, year: 2026 },
  { id: 'ig', name: 'คอนเท้น 1 โพส /สัปดาห์ (Instagram)', memberId: 'a', month: 11, year: 2026 },
  { id: 'general', name: 'งานทั่วไป', memberId: 'a', month: 11, year: 2026 },
  { id: 'oct', name: 'บทความ (Facebook)', memberId: 'a', month: 10, year: 2026 },
  { id: 'other', name: 'บทความ (Facebook)', memberId: 'b', month: 11, year: 2026 },
];

test('content KPIs: assignee, publish month and platform must match; งานทั่วไป never', () => {
  const ids = contentKpiOptions(kpis, 'a', '2026-11-15T03:00:00.000Z', 'Facebook').map(k => k.id);
  assert.deepEqual(ids, ['fbReel', 'fb']); // shortest name first
  assert.deepEqual(contentKpiOptions(kpis, 'a,b', '2026-11-15T03:00:00.000Z', 'Facebook').map(k => k.id).sort(), ['fb', 'fbReel', 'other']);
  assert.deepEqual(contentKpiOptions(kpis, 'a', null, 'Facebook'), []);
  assert.deepEqual(contentKpiOptions(kpis, '', '2026-11-15T03:00:00.000Z', 'Facebook'), []);
});

test('platform match keeps the old aliases', () => {
  assert.equal(isKpiMatchPlatform('Reel IG-MHL', 'Instagram'), true);
  assert.equal(isKpiMatchPlatform('คอนเท้น (Tiktok)', 'TikTok'), true);
  assert.equal(isKpiMatchPlatform('บทความ (Facebook)', 'YouTube'), false);
  assert.equal(isKpiMatchPlatform('อะไรก็ได้', ''), true);
});
