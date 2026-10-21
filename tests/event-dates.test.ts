import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { eventDates, eventDatesLabel, MAX_EVENT_DATES } from '../src/lib/event-dates';

const require = createRequire(import.meta.url);

function loadEventsRoute(prisma: unknown, sent: string[]) {
  const exports: Record<string, (request: Request) => Promise<Response>> = {};
  const compiled = ts.transpileModule(readFileSync('src/app/api/events/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, console, URL,
    require: (name: string) => {
      if (name === '@/lib/prisma') return { prisma };
      if (name === '@/lib/line-notify') return { sendLineNotify: async (message: string) => { sent.push(message); } };
      if (name === '@/lib/workspace-cache') return { cachedJsonRead: (_key: string[], read: () => Promise<Response>) => read(), invalidateWorkspace: () => {} };
      if (name === '@/lib/request-body') return require('../src/lib/request-body.ts');
      if (name === '@/lib/event-dates') return require('../src/lib/event-dates.ts');
      if (name === 'next/server') return require(name);
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return exports;
}

function fixtureDb() {
  const created: { title: string; date: string; time: string | null }[] = [];
  let transactions = 0;
  const prisma = {
    event: {
      create: ({ data }: { data: { title: string; date: Date; time: string | null } }) => {
        created.push({ title: data.title, date: data.date.toISOString().slice(0, 10), time: data.time });
        return { id: `event-${created.length}`, ...data };
      },
    },
    $transaction: async (operations: unknown[]) => { transactions += 1; return Promise.all(operations); },
  };
  return { prisma, created, transactions: () => transactions };
}

const post = (body: unknown) => new Request('http://localhost/api/events', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('selected days are unique, sorted and must be real yyyy-MM-dd dates', () => {
  assert.equal(JSON.stringify(eventDates({ dates: ['2026-10-28', '2026-10-21', '2026-10-28'] })), JSON.stringify(['2026-10-21', '2026-10-28']));
  assert.equal(JSON.stringify(eventDates({ date: '2026-10-21' })), JSON.stringify(['2026-10-21']));
  for (const dates of [[], ['2026-02-30'], ['21/10/2026'], ['2026-10-21', 7], '2026-10-21']) {
    assert.equal(eventDates({ dates }), null);
  }
  assert.equal(eventDates({}), null);
  assert.equal(eventDates({ date: 'not a date' }), null);
});

test('LINE label lists every day in Thai calendar format', () => {
  assert.equal(eventDatesLabel(['2026-10-21', '2026-10-23']), '21/10/2569, 23/10/2569');
});

test('POST with several days creates one record per day in one batch and sends one LINE message', async () => {
  const { prisma, created, transactions } = fixtureDb();
  const sent: string[] = [];
  const route = loadEventsRoute(prisma, sent);
  const response = await route.POST(post({ title: 'อบรม AI', time: '10:00', type: 'event', dates: ['2026-10-23', '2026-10-21', '2026-10-23'], notifyLine: true }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.events.length, 2);
  assert.equal(body.event.id, 'event-1');
  assert.equal(transactions(), 1);
  assert.equal(JSON.stringify(created), JSON.stringify([
    { title: 'อบรม AI', date: '2026-10-21', time: '10:00' },
    { title: 'อบรม AI', date: '2026-10-23', time: '10:00' },
  ]));
  assert.equal(sent.length, 1);
  assert.match(sent[0], /แจ้งเตือนกิจกรรมใหม่: อบรม AI/);
  assert.match(sent[0], /วันที่: 21\/10\/2569, 23\/10\/2569 เวลา 10:00 น\./);
});

test('legacy single-date POST still creates exactly one record', async () => {
  const { prisma, created } = fixtureDb();
  const sent: string[] = [];
  const route = loadEventsRoute(prisma, sent);
  const response = await route.POST(post({ title: 'ประชุม', date: '2026-10-21', time: '' }));
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(created), JSON.stringify([{ title: 'ประชุม', date: '2026-10-21', time: null }]));
  assert.equal(sent.length, 0);
});

test('invalid, missing or too many days are refused before anything is saved', async () => {
  const tooMany = Array.from({ length: MAX_EVENT_DATES + 1 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10));
  for (const body of [
    { title: 'x', dates: [] },
    { title: 'x', dates: ['2026-13-01'] },
    { dates: ['2026-10-21'] },
    { title: 'x', dates: tooMany },
  ]) {
    const { prisma, created, transactions } = fixtureDb();
    const sent: string[] = [];
    const response = await loadEventsRoute(prisma, sent).POST(post(body));
    assert.equal(response.status, 400);
    assert.equal(created.length, 0);
    assert.equal(transactions(), 0);
    assert.equal(sent.length, 0);
  }
});
