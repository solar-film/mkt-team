import test from 'node:test';
import assert from 'node:assert/strict';
import { adsStatus, DATA_SOURCES, daysUntil, expiryStatus, sheetStatus, worst } from '../src/lib/data-sources';

test('daysUntil counts whole days across months', () => {
  assert.equal(daysUntil('2026-11-30', '2026-11-01'), 29);
  assert.equal(daysUntil('2026-11-01', '2026-11-01'), 0);
  assert.equal(daysUntil('2026-10-28', '2026-11-01'), -4);
});

test('expiry turns yellow within 30 days and red within 7', () => {
  assert.equal(expiryStatus(31), 'ok');
  assert.equal(expiryStatus(30), 'soon');
  assert.equal(expiryStatus(8), 'soon');
  assert.equal(expiryStatus(7), 'problem');
  assert.equal(expiryStatus(-1), 'problem');
});

test('sheet data more than 3 days behind is a problem', () => {
  assert.equal(sheetStatus('2026-10-29', '2026-11-01'), 'ok');
  assert.equal(sheetStatus('2026-10-28', '2026-11-01'), 'problem');
});

test('ads pull: failed last run, no success, or 3+ days old is a problem', () => {
  assert.equal(adsStatus('2026-11-01', false, '2026-11-01'), 'ok');
  assert.equal(adsStatus('2026-10-30', false, '2026-11-01'), 'ok');
  assert.equal(adsStatus('2026-10-29', false, '2026-11-01'), 'problem');
  assert.equal(adsStatus('2026-11-01', true, '2026-11-01'), 'problem');
  assert.equal(adsStatus(null, false, '2026-11-01'), 'problem');
});

test('worst keeps the more urgent status and leaves idle alone', () => {
  assert.equal(worst('ok', 'soon'), 'soon');
  assert.equal(worst('problem', 'soon'), 'problem');
  assert.equal(worst('idle', 'problem'), 'idle');
});

test('source list has unique ids and no account or sheet ids (public repository)', () => {
  const ids = DATA_SOURCES.map(source => source.id);
  assert.equal(new Set(ids).size, ids.length);
  const text = JSON.stringify(DATA_SOURCES);
  assert.doesNotMatch(text, /\d{3}-\d{3}-\d{4}/, 'Google Ads account id');
  assert.doesNotMatch(text, /\d{12,}/, 'Facebook account id');
  assert.doesNotMatch(text, /spreadsheets\/d\//, 'sheet id');
});
