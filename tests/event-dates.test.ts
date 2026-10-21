import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { eventSlots, eventSlotsLabel, MAX_EVENT_DATES } from '../src/lib/event-dates';

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
const json = (value: unknown) => JSON.stringify(value);

test('each selected day keeps its own optional time; duplicates collapse and days sort', () => {
  assert.equal(json(eventSlots({ dates: [
    { date: '2026-10-28', time: '14:00' },
    { date: '2026-10-21', time: '10:00' },
    { date: '2026-10-23' },
    { date: '2026-10-28', time: '14:00' },
  ] })), json([
    { date: '2026-10-21', time: '10:00' },
    { date: '2026-10-23', time: null },
    { date: '2026-10-28', time: '14:00' },
  ]));
  assert.equal(json(eventSlots({ date: '2026-10-21', time: '09:30' })), json([{ date: '2026-10-21', time: '09:30' }]));
  assert.equal(json(eventSlots({ date: '2026-10-21', time: '' })), json([{ date: '2026-10-21', time: null }]));
});

test('invalid days or times are refused', () => {
  for (const dates of [[], [{ date: '2026-02-30' }], [{ date: '21/10/2026' }], ['2026-10-21'], [{ date: '2026-10-21', time: '25:00' }], [{ date: '2026-10-21', time: 9 }], '2026-10-21']) {
    assert.equal(eventSlots({ dates }), null, JSON.stringify(dates));
  }
  assert.equal(eventSlots({}), null);
  assert.equal(eventSlots({ date: 'not a date' }), null);
});

test('LINE wording keeps the single-day line and lists several days one per line', () => {
  assert.equal(eventSlotsLabel([{ date: '2026-10-21', time: '10:00' }]), 'วันที่: 21/10/2569 เวลา 10:00 น.');
  assert.equal(eventSlotsLabel([{ date: '2026-10-21', time: '10:00' }, { date: '2026-10-23', time: null }]),
    'วันที่:\n- 21/10/2569 เวลา 10:00 น.\n- 23/10/2569');
});

test('POST with several days creates one record per day with its own time in one batch and sends one LINE message', async () => {
  const { prisma, created, transactions } = fixtureDb();
  const sent: string[] = [];
  const route = loadEventsRoute(prisma, sent);
  const response = await route.POST(post({ title: 'อบรม AI', type: 'event', notifyLine: true, dates: [
    { date: '2026-10-23', time: '14:00' }, { date: '2026-10-21', time: '10:00' }, { date: '2026-10-22', time: '' },
  ] }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.events.length, 3);
  assert.equal(body.event.id, 'event-1');
  assert.equal(transactions(), 1);
  assert.equal(json(created), json([
    { title: 'อบรม AI', date: '2026-10-21', time: '10:00' },
    { title: 'อบรม AI', date: '2026-10-22', time: null },
    { title: 'อบรม AI', date: '2026-10-23', time: '14:00' },
  ]));
  assert.equal(sent.length, 1);
  assert.equal(sent[0], '\n📢 แจ้งเตือนกิจกรรมใหม่: อบรม AI\nวันที่:\n- 21/10/2569 เวลา 10:00 น.\n- 22/10/2569\n- 23/10/2569 เวลา 14:00 น.');
});

test('legacy single-date POST still creates exactly one record with the same LINE line', async () => {
  const { prisma, created } = fixtureDb();
  const sent: string[] = [];
  const route = loadEventsRoute(prisma, sent);
  const response = await route.POST(post({ title: 'ประชุม', date: '2026-10-21', time: '10:00', notifyLine: true }));
  assert.equal(response.status, 200);
  assert.equal(json(created), json([{ title: 'ประชุม', date: '2026-10-21', time: '10:00' }]));
  assert.equal(sent[0], '\n📢 แจ้งเตือนกิจกรรมใหม่: ประชุม\nวันที่: 21/10/2569 เวลา 10:00 น.');
});

test('invalid, missing or too many days are refused before anything is saved', async () => {
  const tooMany = Array.from({ length: MAX_EVENT_DATES + 1 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10) }));
  for (const body of [
    { title: 'x', dates: [] },
    { title: 'x', dates: [{ date: '2026-13-01' }] },
    { title: 'x', dates: [{ date: '2026-10-21', time: '7pm' }] },
    { dates: [{ date: '2026-10-21' }] },
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
