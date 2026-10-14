import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { matchesMemberSelection } from '../src/lib/assignments';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync('src/app/page.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

const timestamp = new Date().toISOString();
const shared = { memberId: 'non,taw', createdAt: timestamp, updatedAt: timestamp, priority: 'medium', deadline: '2026-10-20' };
const tasks = [
  { ...shared, id: 'shared', title: 'Shared task', status: 'todo', company: 'GFS,MHL' },
  { ...shared, id: 'complete', title: 'Completed task', status: 'done', company: 'GFS' },
  { ...shared, id: 'solo', title: 'Solo task', status: 'todo', memberId: 'non', company: 'CAR' },
];
// Task and Content IDs belong to separate tables and must not suppress each other.
const contents = [{ ...shared, id: 'shared', title: 'Shared content', status: 'draft', company: 'MHL', publishDate: '2026-10-21' }];
const people = [{ id: 'non', name: 'NON' }, { id: 'taw', name: 'TAW' }];

function membersFor(selectedTasks = tasks, selectedContents = contents) {
  return people.map(member => ({
    ...member, status: 'active', role: 'Marketing', kpis: [],
    tasks: selectedTasks.filter(item => matchesMemberSelection(item.memberId, member.id)),
    contents: selectedContents.filter(item => matchesMemberSelection(item.memberId, member.id)),
  }));
}

// Render the real page with loaded API data. The mock replaces network/lifecycle/chart
// surfaces only, so assertions cover the dashboard's actual aggregation and display.
function renderDashboard(filterMemberId = 'all', perfTab = 'tasks', members = membersFor()) {
  const states = [members, false, filterMemberId, perfTab, null];
  let stateIndex = 0;
  const exports: { default?: () => React.ReactNode } = {};
  const childrenOnly = ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children);
  vm.runInNewContext(compiled, {
    exports, console,
    require: (name: string) => {
      if (name === 'react') return { ...React, useState: () => [states[stateIndex++], () => {}], useEffect: () => {} };
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '@/contexts/AuthContext') return { useAuth: () => ({ currentUserId: 'non' }) };
      if (name === '@/lib/fetchDashboard') return { fetchDashboardCached: () => { throw new Error('Unexpected network request'); } };
      if (name === '@/lib/assignments') return require('../src/lib/assignments.ts');
      if (name === '@/lib/dashboard-items') return require('../src/lib/dashboard-items.ts');
      if (name === '@/lib/colors') return require('../src/lib/colors.ts');
      if (name === 'next/link') return { default: ({ children, href }: { children: React.ReactNode; href: string }) => React.createElement('a', { href }, children), __esModule: true };
      if (name.startsWith('@/components/')) return { default: childrenOnly, __esModule: true };
      if (name === 'recharts' || name === 'react-icons/hi2') return new Proxy({}, { get: () => childrenOnly });
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return renderToStaticMarkup(exports.default!());
}

function cardValue(html: string, label: string) {
  const match = html.match(new RegExp(`${label}</span></div><div[^>]*><span[^>]*>(\\d+)</span>`));
  assert.ok(match, `Missing dashboard card ${label}`);
  return Number(match[1]);
}

function companyCounts(html: string, name: string) {
  const match = html.match(new RegExp(`>${name}</div><div[^>]*>(\\d+) <span[^>]*>งาน</span></div><div[^>]*>(\\d+) <span[^>]*>งาน</span>`));
  assert.ok(match, `Missing company row ${name}`);
  return [Number(match[1]), Number(match[2])];
}

function performanceCounts(html: string, name: string) {
  const section = html.split(`>${name}</div>`)[1];
  assert.ok(section, `Missing performance row ${name}`);
  const match = section.match(/เสร็จแล้ว <strong[^>]*>(\d+)<\/strong><\/span>.*?ค้าง <strong[^>]*>(\d+)<\/strong>/);
  assert.ok(match, `Missing performance counts ${name}`);
  return [Number(match[1]), Number(match[2])];
}

test('team cards and company totals count shared records once across all assignees', () => {
  const html = renderDashboard();
  assert.equal(cardValue(html, 'งานค้าง'), 2);
  assert.equal(cardValue(html, 'งานเสร็จแล้ว'), 1);
  assert.equal(cardValue(html, 'คอนเทนต์ที่ผลิต'), 1);
  assert.match(html, /จากทั้งหมด 3 งาน/);
  assert.deepEqual(companyCounts(html, 'GFS'), [2, 1]);
  assert.deepEqual(companyCounts(html, 'MHL'), [2, 0]);
  assert.deepEqual(companyCounts(html, 'CAR'), [1, 0]);
  assert.deepEqual(companyCounts(html, 'รวมทั้งหมด'), [4, 1]);
});

test('upcoming records appear once and retain every responsible person', () => {
  const html = renderDashboard();
  assert.equal((html.match(/>Shared task<\/span>/g) || []).length, 1);
  assert.equal((html.match(/>Shared content<\/span>/g) || []).length, 1);
  assert.equal((html.match(/>Solo task<\/span>/g) || []).length, 1);
  assert.equal((html.match(/>NON, TAW<\/td>/g) || []).length, 2);
  assert.match(html, />3 งาน<\/span>/);
});

test('per-person performance keeps shared attribution for both task and content views', () => {
  const html = renderDashboard();
  assert.deepEqual(performanceCounts(html, 'NON'), [1, 2]);
  assert.deepEqual(performanceCounts(html, 'TAW'), [1, 1]);
  const contentHtml = renderDashboard('all', 'contents');
  assert.deepEqual(performanceCounts(contentHtml, 'NON'), [0, 1]);
  assert.deepEqual(performanceCounts(contentHtml, 'TAW'), [0, 1]);
});

test('filtering to a secondary assignee retains shared tasks and excludes another person solo work', () => {
  const html = renderDashboard('taw');
  assert.equal(cardValue(html, 'งานค้าง'), 1);
  assert.equal(cardValue(html, 'งานเสร็จแล้ว'), 1);
  assert.equal(cardValue(html, 'คอนเทนต์ที่ผลิต'), 1);
  assert.doesNotMatch(html, />Solo task<\/span>/);
  assert.deepEqual(companyCounts(html, 'รวมทั้งหมด'), [3, 1]);
});

test('everyone assignments count once globally and remain assigned to every person', () => {
  const everyone = [{ ...tasks[0], memberId: 'all' }];
  const html = renderDashboard('all', 'tasks', membersFor(everyone, []));
  assert.equal(cardValue(html, 'งานค้าง'), 1);
  assert.match(html, />ทุกคน<\/td>/);
  assert.deepEqual(performanceCounts(html, 'NON'), [0, 1]);
  assert.deepEqual(performanceCounts(html, 'TAW'), [0, 1]);
  assert.deepEqual(companyCounts(html, 'รวมทั้งหมด'), [1, 0]);
});
