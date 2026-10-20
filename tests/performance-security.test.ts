import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { startVisibleRefresh } from '../src/lib/visible-refresh';
import { browserWriteRejection } from '../src/lib/browser-request';
import { readJsonBody, RequestBodyError, MAX_JSON_BYTES } from '../src/lib/request-body';
import { safeMeetingHtml } from '../src/lib/rich-text';
import { validAttachment } from '../src/lib/attachments';
import { metricInputValue } from '../src/lib/metric-input';
import { loadSource, isolatedCache, jsonRequest } from './route-harness';

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test('saving an existing zero preserves zero while an empty metric remains null', () => {
  assert.equal(metricInputValue(0), 0);
  assert.equal(metricInputValue('0'), 0);
  assert.equal(metricInputValue(''), null);
  assert.equal(metricInputValue(null), null);
  assert.equal(metricInputValue(undefined), null);
  assert.equal(metricInputValue('123'), 123);
});

test('background tabs stop polling, resume when stale, retain cadence and never overlap', async () => {
  let visible = false, now = 0, reads = 0;
  let change = () => {};
  let scheduled: { callback: () => void; delay: number } | undefined;
  const currentTimer = () => scheduled;
  let complete = () => {};
  const stop = startVisibleRefresh(() => { reads++; return new Promise<void>(resolve => { complete = resolve; }); }, {
    isVisible: () => visible, now: () => now,
    subscribe: listener => { change = listener; return () => { change = () => {}; }; },
    schedule: (callback, delay) => { scheduled = { callback, delay }; return 1; },
    cancel: () => { scheduled = undefined; },
  });
  await flush();
  assert.equal(reads, 0);
  visible = true; change(); change();
  assert.equal(reads, 1);
  assert.equal(scheduled, undefined);
  complete(); await flush();
  assert.equal(currentTimer()?.delay, 120_000);
  now = 90_000; visible = false; change();
  assert.equal(scheduled, undefined);
  visible = true; change();
  assert.equal(currentTimer()?.delay, 30_000);
  now = 120_000; currentTimer()!.callback();
  assert.equal(reads, 2);
  complete(); await flush();
  visible = false; change(); now += 600_000;
  assert.equal(reads, 2);
  visible = true; change();
  assert.equal(reads, 3);
  stop(); complete(); await flush();
  assert.equal(scheduled, undefined);
});

test('internal cache reuses data, separates filters and immediately expires on saves', async () => {
  const { workspace, expirations } = isolatedCache();
  let reads = 0;
  const read = async () => Response.json({ value: ++reads });
  const first = await workspace.cachedJsonRead(['dashboard', 'oil'], read);
  assert.deepEqual(await first.json(), { value: 1 });
  const repeated = await workspace.cachedJsonRead(['dashboard', 'oil'], read);
  assert.deepEqual(await repeated.json(), { value: 1 });
  assert.match(repeated.headers.get('Cache-Control'), /private, no-store/);
  await workspace.cachedJsonRead(['dashboard', 'taw'], read);
  workspace.invalidateWorkspace();
  assert.deepEqual(JSON.parse(JSON.stringify(expirations)), [{ expire: 0 }]);
  assert.deepEqual(await (await workspace.cachedJsonRead(['dashboard', 'oil'], read)).json(), { value: 3 });
  assert.deepEqual(await (await workspace.cachedJsonRead(['dashboard', 'oil'], read, true)).json(), { value: 4 });
});

test('failed and oversized cache responses are returned correctly and retried on next read', async () => {
  const { workspace, values } = isolatedCache();
  let reads = 0;
  const fail = () => { reads++; return Promise.resolve(Response.json({ error: 'Unavailable' }, { status: 503 })); };
  assert.equal((await workspace.cachedJsonRead(['fail'], fail)).status, 503);
  assert.equal((await workspace.cachedJsonRead(['fail'], fail)).status, 503);
  assert.equal(reads, 2);
  const large = 'x'.repeat(1_900_100);
  assert.equal((await workspace.cachedJsonRead(['large'], async () => Response.json({ large }))).status, 200);
  assert.equal(values.size, 0);
});

test('browser writes reject foreign origins and oversized/non-JSON requests without changing profile login', () => {
  const request = (headers: Record<string, string>) => new Request('https://app.example/api/tasks', { method: 'POST', headers });
  assert.equal(browserWriteRejection(request({ Origin: 'https://evil.example', 'Content-Type': 'application/json' })), 403);
  assert.equal(browserWriteRejection(request({ 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'application/json' })), 403);
  assert.equal(browserWriteRejection(request({ 'Content-Type': 'text/plain' })), 415);
  assert.equal(browserWriteRejection(request({ 'Content-Type': 'application/json', 'Content-Length': String(MAX_JSON_BYTES + 1) })), 413);
  assert.equal(browserWriteRejection(request({ Origin: 'https://app.example', 'Content-Type': 'application/json' })), null);
  assert.equal(browserWriteRejection(new Request('http://localhost:3004/api/tasks', {
    method: 'POST', headers: { Origin: 'http://127.0.0.1:3004', Host: '127.0.0.1:3004', 'Content-Type': 'application/json' },
  })), null);
  // Missing origin is deliberately not authentication: API identity remains an accepted limitation.
  assert.equal(browserWriteRejection(request({ 'Content-Type': 'application/json' })), null);
});

test('bounded JSON reader rejects malformed/chunked oversized data but retains dictionary arrays', async () => {
  await assert.rejects(readJsonBody(new Request('http://localhost', { method: 'POST', body: '{' })), RequestBodyError);
  await assert.rejects(readJsonBody(jsonRequest('/', 'POST', [])), RequestBodyError);
  assert.deepEqual(await readJsonBody(jsonRequest('/', 'POST', [{ id: 'kpi' }]), true), [{ id: 'kpi' }]);
  await assert.rejects(readJsonBody(new Request('http://localhost', { method: 'POST', body: 'x'.repeat(MAX_JSON_BYTES + 1) })), (error: any) => error.status === 413);
});

test('meeting HTML keeps Thai text, tables and Quill formatting while stripping executable content', () => {
  const html = safeMeetingHtml('<h2>สรุปประชุม</h2><table style="border-collapse: collapse"><tbody><tr><td colspan="2" style="color: rgb(10, 20, 30); text-align:center">ยอดรวม 123</td></tr></tbody></table><ol><li data-list="bullet"><span class="ql-size-large">งาน</span></li></ol><a href="https://example.com" target="_blank">ดูข้อมูล</a><img src=x onerror=alert(1)><script>alert(1)</script><svg onload=alert(2)></svg><a href="javascript:alert(3)" onclick="alert(4)">ลิงก์</a>')!;
  assert.match(html, /<h2>สรุปประชุม<\/h2>/);
  assert.match(html, /<table/);
  assert.match(html, /colspan="2"/);
  assert.match(html, /ยอดรวม 123/);
  assert.match(html, /ql-size-large/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /script|onerror|onclick|javascript:|onload|<svg|<img/i);
});

test('metric save whitelists fields, accepts every current snapshot and refreshes all cached totals', async () => {
  const { workspace } = isolatedCache();
  const records = Array.from({ length: 501 }, (_, id) => ({
    id: String(id), title: `Content ${id}`, company: 'GFS', companies: ['GFS', 'MHL'],
    memberId: 'oil', memberIds: ['oil', 'taw'], platform: 'Facebook', publishDate: '2026-10-15',
    metrics: [{ snapshot: 'D+7', views: id, reach: 2 * id }],
  }));
  let reads = 0, writes = 0;
  const db = {
    content: { findMany: async (query: any) => { reads++; return query.take ? records.slice(0, query.take) : records; } },
    teamMember: { findMany: async () => [{ id: 'oil', name: 'OIL' }, { id: 'taw', name: 'TAW' }] },
    contentMetric: { upsert: async ({ update, where }: any) => {
      writes++; records[0].metrics = [{ snapshot: where.contentId_snapshot.snapshot, ...update }]; return update;
    } },
  };
  const route = loadSource('src/app/api/content-metrics/route.ts', { '@/lib/prisma': { prisma: db }, '@/lib/workspace-cache': workspace });
  const get = (suffix = '') => route.GET(new Request(`http://localhost/api/content-metrics?month=10&year=2026${suffix}`));
  const before = (await (await get()).json()).contents;
  assert.equal(before.length, 501);
  assert.equal(before.reduce((sum: number, c: any) => sum + c.metrics[0].views, 0), 125_250);
  await get('&t=9876');
  assert.equal(reads, 1, 'cache-buster timestamps must not multiply database reads');
  for (const snapshot of ['D+7', 'D+15', 'D+30']) {
    const response = await route.POST(jsonRequest('/api/content-metrics', 'POST', { contentId: '0', snapshot, metrics: { views: 0, reach: null, adSpend: 0 }, recordedById: 'oil' }));
    assert.equal(response.status, 200);
  }
  const saved = await route.POST(jsonRequest('/api/content-metrics', 'POST', { contentId: '0', snapshot: 'D+7', metrics: { views: 999 } }));
  assert.equal(saved.status, 200);
  const after = (await (await get()).json()).contents;
  assert.equal(after.length, 501);
  assert.equal(after.reduce((sum: number, c: any) => sum + c.metrics[0].views, 0), 126_249);
  assert.equal(reads, 2);
  for (const metrics of [{ contentId: 'different' }, { views: -1 }, { views: 1.5 }, { views: 2_147_483_648 }, { adSpend: null }]) {
    assert.equal((await route.POST(jsonRequest('/api/content-metrics', 'POST', { contentId: '0', snapshot: 'D+7', metrics }))).status, 400);
  }
  assert.equal(writes, 4);
  assert.equal((await route.GET(new Request('http://localhost/api/content-metrics?month=13&year=2026'))).status, 400);
});

test('page overview saves preserve hidden Inbox/ad-spend totals and accept a new month with omitted metrics', async () => {
  let stored: Record<string, any> = { followers: 10, reach: 20, messages: 512, adSpend: 123.5 };
  let writes = 0;
  const route = loadSource('src/app/api/channel-metrics/route.ts', { '@/lib/prisma': { prisma: { channelMetric: {
    upsert: async ({ update, create }: any) => {
      writes++;
      if (create.month === 11) stored = {};
      Object.assign(stored, Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined)));
      return stored;
    },
  } } } });
  const post = (body: Record<string, any>) => route.POST(jsonRequest('/api/channel-metrics', 'POST', { channelId: 'gfs', month: '10', year: '2026', ...body }));
  const response = await post({ followers: 0, reach: 0 });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { followers: 0, reach: 0, messages: 512, adSpend: 123.5, recordedById: null, recordedDate: null });
  assert.equal((await post({ month: '11', followers: '123' })).status, 200);
  assert.equal(stored.followers, 123);
  assert.equal(stored.messages, undefined);
  assert.equal((await post({ reach: -1 })).status, 400);
  assert.equal((await post({ month: 13 })).status, 400);
  assert.equal(writes, 2);
});

test('ideas list and selected detail exclude file bodies and retain search text and comment counts', async context => {
  const attachment = { id: 'file', name: 'photo.jpg', type: 'image/jpeg', url: `data:image/jpeg;base64,${'A'.repeat(256_000)}`, createdAt: '2026-10-15' };
  const notes = Array.from({ length: 100 }, (_, id) => ({ id: String(id), title: 'ไอเดีย', description: 'คำที่ค้นหา', attachments: [attachment], checklists: [], comments: [{ text: 'ความเห็น' }] }));
  const db = { ideaNote: {
    findMany: async ({ include }: any) => notes.map(({ attachments, checklists, comments, ...note }) => {
      assert.equal(include._count.select.comments, true);
      return { ...note, _count: { comments: comments.length } };
    }),
    findUnique: async ({ where, include }: any) => {
      assert.equal(include.attachments.select.url, undefined);
      const note = notes.find(note => note.id === where.id);
      return note && { ...note, attachments: note.attachments.map(({ url, ...metadata }) => metadata) };
    },
  } };
  const mocks = { '@/lib/prisma': { prisma: db }, '@/lib/line-notify': { sendLineNotify: () => { throw new Error('Unexpected notification'); } } };
  const list = loadSource('src/app/api/ideas/route.ts', mocks);
  const detail = loadSource('src/app/api/ideas/[id]/route.ts', mocks);
  const listResponse = await list.GET(new Request('http://localhost/api/ideas?view=list'));
  const payload = await listResponse.text();
  const results = JSON.parse(payload);
  assert.equal(results.length, 100);
  assert.equal(results[0].description, 'คำที่ค้นหา');
  assert.equal(results[0]._count.comments, 1);
  assert.doesNotMatch(payload, /base64|photo.jpg/);
  const selected = await (await detail.GET(new Request('http://localhost/api/ideas/0'), { params: Promise.resolve({ id: '0' }) })).json();
  assert.equal(selected.comments.length, 1);
  assert.equal(selected.attachments[0].url, '/api/ideas/0/attachments?attachmentId=file');
  const oldSize = Buffer.byteLength(JSON.stringify(notes)), newSize = Buffer.byteLength(payload);
  assert.ok(newSize < oldSize / 100);
  context.diagnostic(`Synthetic 100-note list: ${oldSize} -> ${newSize} bytes; this is not a production traffic estimate.`);
});

test('child mutations cannot alter an attachment/checklist/comment belonging to another note', async context => {
  context.mock.method(console, 'error', () => {});
  for (const [kind, model, parameter] of [['attachments', 'ideaAttachment', 'attachmentId'], ['checklists', 'ideaChecklist', 'checklistId'], ['comments', 'ideaComment', 'commentId']]) {
    let deleted = false;
    const route = loadSource(`src/app/api/ideas/[id]/${kind}/route.ts`, { '@/lib/prisma': { prisma: { [model]: {
      delete: async ({ where }: any) => {
        if (where.id === 'foreign-child' && where.ideaNoteId === 'owner-note') { deleted = true; return {}; }
        throw Object.assign(new Error('Not found'), { code: 'P2025' });
      },
      update: async ({ where }: any) => {
        if (where.ideaNoteId === 'owner-note') return { id: where.id, isDone: true };
        throw Object.assign(new Error('Not found'), { code: 'P2025' });
      },
    } } } });
    const response = await route.DELETE(new Request(`http://localhost/api/ideas/other-note/${kind}?${parameter}=foreign-child`), { params: Promise.resolve({ id: 'other-note' }) });
    assert.ok(response.status >= 400);
    assert.equal(deleted, false);
    if (kind === 'checklists') assert.ok((await route.PUT(jsonRequest('/', 'PUT', { id: 'foreign-child', isDone: true }), { params: Promise.resolve({ id: 'other-note' }) })).status >= 400);
    assert.equal((await route.DELETE(new Request(`http://localhost/api/ideas/owner-note/${kind}?${parameter}=foreign-child`), { params: Promise.resolve({ id: 'owner-note' }) })).status, 200);
    assert.equal(deleted, true);
  }
});

test('attachments validate image contents and serve only a file scoped to the selected note', async () => {
  const url = 'data:image/jpeg;base64,/9j/2Q==';
  assert.equal(validAttachment('a.jpg', 'image/jpeg', url), true);
  assert.equal(validAttachment('a.jpg', 'image/jpeg', 'data:image/jpeg;base64,PHNjcmlwdD4='), false);
  assert.equal(validAttachment('a.svg', 'image/svg+xml', 'data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(validAttachment('a.jpg', 'image/jpeg', 'https://evil.example/file'), false);
  const route = loadSource('src/app/api/ideas/[id]/attachments/route.ts', { '@/lib/prisma': { prisma: { ideaAttachment: {
    findFirst: async ({ where }: any) => where.ideaNoteId === 'owner-note' ? { name: 'ภาพ.jpg', url } : null,
  } } } });
  const request = new Request('http://localhost/api/ideas/owner-note/attachments?attachmentId=file');
  const response = await route.GET(request, { params: Promise.resolve({ id: 'owner-note' }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
  assert.equal((await response.arrayBuffer()).byteLength, 4);
  assert.equal((await route.GET(request, { params: Promise.resolve({ id: 'other-note' }) })).status, 404);
});

test('LINE verifies raw-body signature before sending, and cron rejects unauthenticated invocations', async () => {
  let requests = 0, reads = 0;
  const globals = { process: { env: { LINE_CHANNEL_SECRET: 'test-secret', CRON_SECRET: 'test-cron' } }, fetch: async () => { requests++; return new Response('{}'); } };
  const line = loadSource('src/app/api/line-webhook/route.ts', {}, globals);
  const raw = '{"events":[]}';
  const signature = createHmac('sha256', 'test-secret').update(raw).digest('base64');
  const request = (body: string, sig?: string) => new Request('http://localhost/api/line-webhook', { method: 'POST', body, headers: sig ? { 'x-line-signature': sig } : {} });
  assert.equal((await line.POST(request(raw, signature))).status, 200);
  assert.equal((await line.POST(request(raw + ' ', signature))).status, 401);
  assert.equal((await line.POST(request('{"events":[{"type":"message","message":{"type":"text","text":"!id"}}]}'))).status, 401);
  const disabled = loadSource('src/app/api/line-webhook/route.ts');
  assert.equal((await disabled.POST(request(raw, signature))).status, 503);
  const cron = loadSource('src/app/api/cron/deadline/route.ts', { '@/lib/prisma': { prisma: { task: { findMany: async () => { reads++; return []; } }, content: { findMany: async () => [] } } } }, globals);
  assert.equal((await cron.GET(new Request('http://localhost/api/cron/deadline'))).status, 401);
  assert.equal(reads, 0);
  assert.equal((await cron.GET(new Request('http://localhost/api/cron/deadline', { headers: { Authorization: 'Bearer test-cron' } }))).status, 200);
  assert.equal(reads, 1);
  assert.equal(requests, 0);
});

test('retired maintenance URLs never initialize Prisma or run schema changes', async () => {
  for (const route of ['migrate', 'migrate-name', 'migrate-kpi', 'setup-db', 'setup-db-2', 'test-db']) {
    const api = loadSource(`src/app/api/${route}/route.ts`, { '@/lib/prisma': new Proxy({}, { get() { throw new Error('Database access forbidden'); } }) });
    assert.equal((await api.GET()).status, 404);
  }
});

test('dashboard client shares only concurrent requests and immediately fetches again after completion', async () => {
  let calls = 0;
  let finish = (_response: Response) => {};
  const client = loadSource('src/lib/fetchDashboard.ts', { '@/lib/workspace-fetch': {
    workspaceRevision: () => 0,
    fetchWorkspace: () => { calls++; return new Promise<Response>(resolve => { finish = resolve; }); },
  } });
  const a = client.fetchDashboardCached('/api/dashboard');
  const b = client.fetchDashboardCached('/api/dashboard?memberId=all');
  assert.equal(calls, 1);
  finish(Response.json({ value: 1 }));
  assert.deepEqual(await (await a).json(), { value: 1 });
  assert.deepEqual(await (await b).json(), { value: 1 });
  const c = client.fetchDashboardCached('/api/dashboard');
  assert.equal(calls, 2);
  finish(Response.json({ value: 2 }));
  assert.deepEqual(await (await c).json(), { value: 2 });
});

test('the client bypasses cached reads after a successful save but preserves normal cached reads otherwise', async () => {
  const urls: string[] = [];
  let status = 200;
  const client = loadSource('src/lib/workspace-fetch.ts', {}, { fetch: async (url: string) => {
    urls.push(url); return Response.json({}, { status });
  } });
  await client.fetchWorkspace('/api/ideas?view=list');
  await client.fetchWorkspace('/api/ideas', { method: 'PUT' });
  await client.fetchWorkspace('/api/ideas?view=list');
  await client.fetchWorkspace('/api/ideas/id');
  assert.deepEqual(urls, ['/api/ideas?view=list', '/api/ideas', '/api/ideas?view=list&fresh=1', '/api/ideas/id?fresh=1']);
  assert.equal(client.workspaceRevision(), 1);
  status = 400;
  await client.fetchWorkspace('/api/ideas', { method: 'PUT' });
  assert.equal(client.workspaceRevision(), 1);
});

test('admin login uses a server secret and signed HttpOnly cookie instead of a browser-stored flag', async () => {
  const globals = { process: { env: { ADMIN_PASSWORD: 'test-only-admin-secret', NODE_ENV: 'production' } } };
  const admin = loadSource('src/lib/admin-session.ts', {}, globals);
  const route = loadSource('src/app/api/admin/session/route.ts', { '@/lib/admin-session': admin }, globals);
  const wrong = await route.POST(jsonRequest('/api/admin/session', 'POST', { password: 'wrong' }));
  assert.equal(wrong.status, 401);
  const response = await route.POST(jsonRequest('/api/admin/session', 'POST', { password: 'test-only-admin-secret' }));
  assert.equal(response.status, 200);
  const cookie = response.headers.get('Set-Cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=strict/i);
  assert.match(cookie, /Secure/i);
  assert.doesNotMatch(cookie, /test-only-admin-secret/);
  const authenticated = new Request('https://app.example/api/admin/data', { headers: { Cookie: cookie!.split(';')[0] } });
  assert.equal(admin.hasAdminSession(authenticated), true);
  assert.equal(admin.hasAdminSession(new Request('https://app.example/api/admin/data', { headers: { Cookie: 'admin_auth=true; mkt_admin_session=9999999999999.fake' } })), false);
  const disabled = loadSource('src/lib/admin-session.ts');
  assert.equal(disabled.hasAdminSession(authenticated), false);
  assert.equal((await route.DELETE()).headers.get('Set-Cookie')?.includes('Max-Age=0'), true);
});

test('admin data requires the signed server session before reading or deleting any table', async () => {
  let calls = 0;
  const mocks: Record<string, any> = {
    '@/lib/admin-session': { hasAdminSession: (request: Request) => request.headers.get('cookie') === 'fixture-valid-session' },
  };
  for (const table of ['events', 'tasks', 'kpis', 'content', 'ideas', 'meetings', 'members']) {
    mocks[`@/app/api/${table}/route`] = {
      GET: async () => { calls++; return Response.json([]); },
      DELETE: async () => { calls++; return Response.json({ success: true }); },
    };
  }
  const route = loadSource('src/app/api/admin/data/route.ts', mocks);
  assert.equal((await route.GET(new Request('https://app.example/api/admin/data?table=tasks'))).status, 401);
  assert.equal((await route.DELETE(new Request('https://app.example/api/admin/data?table=tasks&id=x', { method: 'DELETE' }))).status, 401);
  assert.equal(calls, 0);
  const request = (table: string) => new Request(`https://app.example/api/admin/data?table=${table}`, { headers: { Cookie: 'fixture-valid-session' } });
  assert.equal((await route.GET(request('tasks'))).status, 200);
  assert.equal((await route.DELETE(request('contents'))).status, 200);
  assert.equal((await route.GET(request('__proto__'))).status, 400);
  assert.equal(calls, 2);
});
