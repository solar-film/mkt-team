import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import * as assignments from '../src/lib/assignments';

const require = createRequire(import.meta.url);
const members = [{ id: 'oil', name: 'OIL', avatar: null }, { id: 'taw', name: 'TAW', avatar: null }];
const shared = {
  id: 'shared', title: 'Shared content', memberId: 'oil', memberIds: ['oil', 'taw'],
  company: 'GFS', companies: ['GFS', 'MHL'], member: members[0], assignedMembers: members,
  platform: 'Facebook', publishDate: '2026-10-15T10:00:00.000Z',
  metrics: [{ snapshot: 'D+7', views: 100, reach: 80, likes: 4, comments: 3, shares: 2, saves: 1 }],
};
const legacy = {
  id: 'legacy', title: 'Legacy content', memberId: 'taw', memberIds: [],
  company: 'MHL', companies: [], member: members[1], platform: 'Facebook',
  publishDate: '2026-10-14T10:00:00.000Z', metrics: [{ snapshot: 'D+7', views: 30, reach: 20 }],
};

function loadModule(path: string, mocks: Record<string, unknown> = {}, appended = '') {
  const exports: Record<string, any> = {};
  const compiled = ts.transpileModule(readFileSync(path, 'utf8') + appended, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, console, URL, Request,
    require: (name: string) => {
      if (name === '@/lib/workspace-cache') return { cachedJsonRead: (_key: string[], read: () => Promise<Response>) => read(), invalidateWorkspace: () => {} };
      if (name === '@/lib/request-body') return require('../src/lib/request-body.ts');
      if (name === '@/lib/workspace-fetch') return require('../src/lib/workspace-fetch.ts');
      if (name === '@/lib/metric-input') return require('../src/lib/metric-input.ts');
      if (name in mocks) return mocks[name];
      if (name === '@/lib/assignments') return assignments;
      if (name === '@/lib/colors') return require('../src/lib/colors.ts');
      if (name.endsWith('.module.css')) return {};
      return require(name);
    },
  });
  return exports;
}

// A read-only Prisma adapter evaluates the filter against fixtures; no database or credentials are used.
function matchesWhere(row: Record<string, any>, where: Record<string, any>): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (field === 'AND') return condition.every((clause: any) => matchesWhere(row, clause));
    if (field === 'OR') return condition.some((clause: any) => matchesWhere(row, clause));
    if (typeof condition !== 'object') return row[field] === condition;
    if ('has' in condition) return row[field]?.includes(condition.has);
    if ('contains' in condition) return row[field].toLowerCase().includes(condition.contains.toLowerCase());
    if ('gte' in condition) return new Date(row[field]) >= condition.gte && new Date(row[field]) < condition.lt;
    throw new Error(`Unsupported test filter: ${field}`);
  });
}

const records = [
  shared, legacy,
  { ...shared, id: 'outside-month', publishDate: '2026-09-15T10:00:00.000Z' },
  { ...shared, id: 'other-platform', platform: 'TikTok' },
  { ...shared, id: 'other-owner', memberId: 'oil', memberIds: ['oil'], companies: ['MHL'] },
  { ...shared, id: 'other-company', memberId: 'taw', memberIds: ['taw'], company: 'CAR', companies: ['CAR'] },
  { ...shared, id: 'everyone', memberIds: ['all'], company: 'CAR', companies: ['CAR'] },
];
const api = loadModule('src/app/api/content-metrics/route.ts', {
  '@/lib/prisma': { prisma: {
    content: { findMany: async ({ where }: any) => records.filter(row => matchesWhere(row, where)) },
    teamMember: { findMany: async ({ where }: any) => members.filter(member => where.id.in.includes(member.id)) },
  } },
});

test('metrics filter includes a secondary owner and company once and keeps the filters intersected', async () => {
  const response = await api.GET(new Request('http://localhost/api/content-metrics?memberId=taw&company=MHL&platform=facebook&month=10&year=2026'));
  assert.equal(response.status, 200);
  const { contents } = await response.json();
  assert.deepEqual(contents.map((content: any) => content.id), ['shared', 'legacy']);
  assert.equal(contents[0].memberId, 'oil,taw');
  assert.equal(contents[0].company, 'GFS,MHL');
  assert.deepEqual(contents[0].assignedMembers.map((member: any) => member.name), ['OIL', 'TAW']);
  assert.deepEqual(contents[1].memberIds, ['taw']);
  assert.deepEqual(contents[1].companies, ['MHL']);
});

test('everyone assignments are visible to each owner without duplicating the content', async () => {
  const response = await api.GET(new Request('http://localhost/api/content-metrics?memberId=oil&company=CAR&month=10&year=2026'));
  const { contents } = await response.json();
  assert.deepEqual(contents.map((content: any) => content.id), ['everyone']);
  assert.deepEqual(contents[0].memberIds, ['all']);
  assert.deepEqual(contents[0].assignedMembers, []);
});

const summaryModule = loadModule('src/app/content-stats/components/SummaryTab.tsx');

test('shared metrics contribute once globally and one row shows the complete owner group', () => {
  const result = summaryModule.summarizeContentMetrics([shared, legacy]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.totals)), { contents: 2, views: 130, reach: 100, engagement: 10 });
  assert.equal(result.summary.length, 2);
  assert.equal(result.summary[0].name, 'OIL, TAW');
  assert.equal(result.summary[0].count, 1);
  assert.equal(result.summary[0].views, 100);
  assert.equal(result.summary[1].name, 'TAW');
});

test('the same owners in a different selection order still form one group', () => {
  const result = summaryModule.summarizeContentMetrics([shared, { ...shared, id: 'shared-2', memberIds: ['taw', 'oil'] }]);
  assert.equal(result.summary.length, 1);
  assert.equal(result.summary[0].count, 2);
  assert.equal(result.summary[0].avgViews, 100);
  assert.equal(result.totals.views, 200);
  const everyone = summaryModule.summarizeContentMetrics([{ ...shared, memberIds: ['all'], assignedMembers: [] }]);
  assert.equal(everyone.summary[0].name, 'ทุกคน');
  assert.equal(everyone.totals.contents, 1);
});

test('record rows display every company and responsible owner while retaining one metrics row', () => {
  const react = require('react');
  const rowModule = loadModule('src/app/content-stats/components/RecordStatsTab.tsx', {
    react: { ...react, useState: (value: unknown) => [value, () => {}], useEffect: () => {} },
    '@/contexts/AuthContext': { useAuth: () => ({ currentUserId: 'oil' }) },
  }, '\nexports.ContentRow = ContentRow;');
  const markup = renderToStaticMarkup(rowModule.ContentRow({ content: shared, initialMetric: {}, snapshot: 'D+7', dueAlert: false, onSave: () => {}, saving: false }));
  assert.match(markup, /\[GFS\]/);
  assert.match(markup, /\[MHL\]/);
  assert.match(markup, /OIL, TAW/);
  assert.equal((markup.match(/<tr /g) || []).length, 1);
});

test('reopening and saving a zero-valued statistic keeps zero rather than clearing the field', () => {
  const react = require('react');
  const rowModule = loadModule('src/app/content-stats/components/RecordStatsTab.tsx', {
    react: { ...react, useState: (value: unknown) => [value, () => {}], useEffect: () => {} },
    '@/contexts/AuthContext': { useAuth: () => ({ currentUserId: 'oil' }) },
  }, '\nexports.ContentRow = ContentRow;');
  let saved: any;
  const row = rowModule.ContentRow({ content: shared, initialMetric: { views: 0, reach: 0 }, snapshot: 'D+7', onSave: (value: any) => { saved = value; } });
  const markup = renderToStaticMarkup(row);
  assert.ok((markup.match(/value="0"/g) || []).length >= 2);
  const buttons: any[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === 'button' && node.props.onClick) buttons.push(node);
    visit(node.props?.children);
  };
  visit(row);
  buttons.at(-1).props.onClick();
  assert.equal(saved.views, 0);
  assert.equal(saved.reach, 0);
  assert.equal(saved.likes, null);
});

test('top-content and summary tables show shared selections and shared-group wording', () => {
  const react = require('react');
  const { summary, totals } = summaryModule.summarizeContentMetrics([shared]);
  const state = [summary, [shared], [], totals, false, '10', '2026'];
  let index = 0;
  const component = loadModule('src/app/content-stats/components/SummaryTab.tsx', {
    react: { ...react, useState: () => [state[index++], () => {}], useEffect: () => {} },
  }).default;
  const markup = renderToStaticMarkup(component());
  assert.match(markup, /กลุ่มผู้รับผิดชอบ/);
  assert.match(markup, /นับผลงานหนึ่งครั้งต่อกลุ่ม/);
  assert.equal((markup.match(/OIL, TAW/g) || []).length, 2);
  assert.match(markup, />GFS<\/span>/);
  assert.match(markup, />MHL<\/span>/);
});
