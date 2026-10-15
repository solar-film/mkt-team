import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as assignments from '../src/lib/assignments';
import * as notifications from '../src/lib/notification-assignees';

const require = createRequire(import.meta.url);
const members = [{ id: 'oil', name: 'OIL' }, { id: 'taw', name: 'TAW' }];
const shared = { id: 'shared', title: 'Shared work', memberId: 'oil', memberIds: ['oil', 'taw'], member: members[0], company: 'GFS', companies: ['GFS'] };

function loadRoute(path: string, prisma: unknown, sent: string[], pushed: string[] = []) {
  const exports: Record<string, (request?: Request) => Promise<Response>> = {};
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, console, URL,
    // Dummy VM-only values exercise the cron payload without reading real credentials.
    process: { env: { LINE_CHANNEL_ACCESS_TOKEN: 'test-token', LINE_GROUP_ID: 'test-group', CRON_SECRET: 'test-cron' } },
    fetch: async (_url: string, options: { body: string }) => {
      pushed.push(JSON.parse(options.body).messages[0].text);
      return new Response('{}');
    },
    require: (name: string) => {
      if (name === '@/lib/prisma') return { prisma };
      if (name === '@/lib/assignments') return assignments;
      if (name === '@/lib/notification-assignees') return notifications;
      if (name === '@/lib/assignment-storage') return { assignmentData: async () => ({}) };
      if (name === '@/lib/line-notify') return { sendLineNotify: async (message: string) => { sent.push(message); } };
      if (name === '@/lib/workspace-cache') return { cachedJsonRead: (_key: string[], read: () => Promise<Response>) => read(), invalidateWorkspace: () => {} };
      if (name === '@/lib/request-body') return require('../src/lib/request-body.ts');
      if (name === '@/lib/rich-text') return require('../src/lib/rich-text.ts');
      if (name === '@/lib/integration-security') return require('../src/lib/integration-security.ts');
      if (name === 'next/server') return require(name);
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return exports;
}

function fixtureDb(record = shared) {
  const lookups: string[][] = [];
  const prisma = {
    task: { create: async () => record, update: async () => record },
    content: { create: async () => record, update: async () => record },
    teamMember: { findMany: async ({ where }: { where: { id: { in: string[] } } }) => {
      lookups.push(where.id.in);
      return members.filter(member => where.id.in.includes(member.id));
    } },
  };
  return { prisma, lookups };
}

for (const kind of ['tasks', 'content']) {
  for (const method of ['POST', 'PUT']) {
    test(`${method} ${kind} notification shows all stored assignees`, async () => {
      const { prisma, lookups } = fixtureDb();
      const sent: string[] = [];
      const route = loadRoute(`src/app/api/${kind}/route.ts`, prisma, sent);
      const request = new Request(`http://localhost/api/${kind}`, {
        method, headers: { 'Content-Type': 'application/json' },
        // No assignment changes on PUT: labels must come from stored selections.
        body: JSON.stringify({ id: shared.id, title: shared.title, status: 'done', notifyLine: true }),
      });
      const response = await route[method](request);
      assert.equal(response.status, 200);
      assert.equal(sent.length, 1);
      assert.match(sent[0], /ผู้รับผิดชอบ: OIL, TAW/);
      assert.deepEqual(lookups, [['taw']]);
    });
  }
}

test('single legacy owner and everyone labels need no extra database lookup', async () => {
  for (const [record, expected] of [
    [{ ...shared, memberIds: [] }, 'OIL'],
    [{ ...shared, memberIds: ['all'] }, 'ทุกคน'],
  ] as [typeof shared, string][]) {
    const { prisma, lookups } = fixtureDb(record);
    const sent: string[] = [];
    const route = loadRoute('src/app/api/tasks/route.ts', prisma, sent);
    const response = await route.PUT(new Request('http://localhost/api/tasks', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: record.id, notifyLine: true }),
    }));
    assert.equal(response.status, 200);
    assert.ok(sent[0].includes(`ผู้รับผิดชอบ: ${expected}`));
    assert.deepEqual(lookups, []);
  }
});

test('saving without notifyLine neither fetches additional names nor sends a message', async () => {
  const { prisma, lookups } = fixtureDb();
  const sent: string[] = [];
  const route = loadRoute('src/app/api/content/route.ts', prisma, sent);
  const response = await route.PUT(new Request('http://localhost/api/content', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: shared.id, status: 'published' }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(lookups, []);
  assert.deepEqual(sent, []);
});

test('secondary-name lookup failure does not report an already-saved task as failed', async context => {
  const { prisma } = fixtureDb();
  let saved = 0;
  prisma.task.create = async () => { saved += 1; return shared; };
  prisma.teamMember.findMany = async () => { throw new Error('Enrichment unavailable'); };
  const warning = context.mock.method(console, 'warn', () => {});
  const sent: string[] = [];
  const route = loadRoute('src/app/api/tasks/route.ts', prisma, sent);
  const response = await route.POST(new Request('http://localhost/api/tasks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: shared.title, notifyLine: true }),
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.equal(saved, 1);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /ผู้รับผิดชอบ: OIL/);
  assert.equal(warning.mock.callCount(), 1);
  assert.deepEqual(warning.mock.calls[0].arguments, ['Unable to load additional assignee names for notification.']);
});

test('deadline reminders batch assignee names once and preserve legacy/everyone labels', async () => {
  const deadline = (offset: number) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return date;
  };
  const due = [
    { ...shared, id: 'overdue', title: 'Legacy overdue', memberIds: [], deadline: deadline(-1) },
    { ...shared, id: 'tomorrow', title: 'Shared tomorrow', deadline: deadline(1) },
    { ...shared, id: 'three-days', title: 'Everyone deadline', memberIds: ['all'], deadline: deadline(3) },
  ];
  const { prisma, lookups } = fixtureDb();
  const db = { ...prisma, task: { findMany: async () => due } };
  const pushed: string[] = [];
  const route = loadRoute('src/app/api/cron/deadline/route.ts', db, [], pushed);
  const response = await route.GET(new Request('http://localhost/api/cron/deadline', { headers: { Authorization: 'Bearer test-cron' } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).notifiedCount, 3);
  assert.deepEqual(lookups, [['taw']]);
  assert.equal(pushed.length, 1);
  assert.match(pushed[0], /Legacy overdue \(@OIL\)/);
  assert.match(pushed[0], /Shared tomorrow \(@OIL, TAW\)/);
  assert.match(pushed[0], /Everyone deadline \(@ทุกคน\)/);
});

test('deadline run without due work skips name lookup and notifications', async () => {
  const { prisma, lookups } = fixtureDb();
  const pushed: string[] = [];
  const route = loadRoute('src/app/api/cron/deadline/route.ts', { ...prisma, task: { findMany: async () => [] } }, [], pushed);
  const response = await route.GET(new Request('http://localhost/api/cron/deadline', { headers: { Authorization: 'Bearer test-cron' } }));
  assert.equal(response.status, 200);
  assert.deepEqual(lookups, []);
  assert.deepEqual(pushed, []);
});
