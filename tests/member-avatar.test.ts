import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSource, jsonRequest } from './route-harness';
import { MAX_AVATAR_BYTES, avatarUrl, validAvatar } from '../src/lib/member-avatar';

const jpeg = (size: number) => {
  const bytes = Buffer.alloc(size);
  bytes.set([0xff, 0xd8, 0xff], 0);
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
};
const updatedAt = new Date('2026-10-20T03:00:00.000Z');
// Fixtures only: no database, network or production credentials are used.
const rows = [
  { id: 'oil', name: 'OIL', role: 'Admin', company: 'GFS', status: 'active', createdAt: updatedAt, updatedAt, avatar: jpeg(900_000) },
  { id: 'taw', name: 'TAW', role: 'Staff', company: 'GFS', status: 'active', createdAt: updatedAt, updatedAt, avatar: null },
  { id: 'non', name: 'NON', role: 'Staff', company: 'MHL', status: 'active', createdAt: updatedAt, updatedAt, avatar: '' },
];

function fakePrisma(calls: any[]) {
  const pick = (row: any, select?: Record<string, any>) => select
    ? Object.fromEntries(Object.keys(select).filter(key => select[key] === true || typeof select[key] === 'object').map(key => [key, row[key]]))
    : { ...row };
  const hasPhoto = (row: any) => row.avatar !== null && row.avatar !== '';
  return {
    teamMember: {
      findMany: async (args: any) => {
        calls.push(args);
        let result = rows.filter(row => row.id !== 'all');
        if (args.where?.id?.in) result = result.filter(row => args.where.id.in.includes(row.id));
        if (args.where?.AND) result = result.filter(hasPhoto);
        return result.map(row => pick(row, args.select));
      },
      findUnique: async (args: any) => {
        calls.push(args);
        const row = rows.find(member => member.id === args.where.id);
        return row ? pick(row, args.select) : null;
      },
      update: async (args: any) => {
        calls.push(args);
        const row = rows.find(member => member.id === args.where.id)!;
        return pick({ ...row, ...Object.fromEntries(Object.entries(args.data).filter(([, value]) => value !== undefined)) }, args.select);
      },
    },
  };
}

test('avatar validation keeps small images and rejects full-size photos or non-images', () => {
  assert.equal(validAvatar(null), true);
  assert.equal(validAvatar(''), true);
  assert.equal(validAvatar(jpeg(8_000)), true);
  assert.equal(validAvatar(jpeg(MAX_AVATAR_BYTES + 1)), false);
  assert.equal(validAvatar('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), false);
  assert.equal(validAvatar(`data:image/png;base64,${Buffer.from('not a png').toString('base64')}`), false);
  assert.equal(validAvatar('https://example.com/photo.jpg'), false);
});

test('member lists never read avatar bytes and return a versioned avatar URL instead', async () => {
  const calls: any[] = [];
  const route = loadSource('src/app/api/members/route.ts', { '@/lib/prisma': { prisma: fakePrisma(calls) } });
  const response = await route.GET(new Request('http://localhost/api/members'));
  const members = await response.json();
  assert.equal(calls[0].select.avatar, undefined);
  assert.deepEqual(calls[1].select, { id: true });
  assert.equal(members.find((m: any) => m.id === 'oil').avatar, avatarUrl({ id: 'oil', updatedAt }));
  assert.equal(members.find((m: any) => m.id === 'taw').avatar, null);
  assert.equal(members.find((m: any) => m.id === 'non').avatar, null);
  assert.ok(JSON.stringify(members).length < 2_000);
});

test('dashboard members carry avatar URLs without avatar bytes', async () => {
  const calls: any[] = [];
  const prisma: any = fakePrisma(calls);
  for (const model of ['task', 'content', 'kPI', 'meeting', 'event', 'ideaNote']) prisma[model] = { findMany: async () => [] };
  const route = loadSource('src/app/api/dashboard/route.ts', { '@/lib/prisma': { prisma } });
  const body = await (await route.GET(new Request('http://localhost/api/dashboard'))).json();
  assert.equal(calls[0].select.avatar, undefined);
  assert.match(body.members.find((m: any) => m.id === 'oil').avatar, /^\/api\/members\/oil\/avatar\?v=\d+$/);
  assert.ok(!JSON.stringify(body).includes('base64'));
});

test('avatar URL serves image bytes once with a long private cache and 404s without a photo', async () => {
  const calls: any[] = [];
  const route = loadSource('src/app/api/members/[id]/avatar/route.ts', { '@/lib/prisma': { prisma: fakePrisma(calls) } });
  const found = await route.GET(new Request('http://localhost/api/members/oil/avatar?v=1'), { params: Promise.resolve({ id: 'oil' }) });
  assert.equal(found.status, 200);
  assert.equal(found.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(found.headers.get('Cache-Control'), 'private, max-age=31536000, immutable');
  assert.equal(found.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal((await found.arrayBuffer()).byteLength, 900_000);
  const missing = await route.GET(new Request('http://localhost/api/members/taw/avatar'), { params: Promise.resolve({ id: 'taw' }) });
  assert.equal(missing.status, 404);
});

test('profile photo uploads over the limit are refused before saving; accepted saves return a URL', async () => {
  const calls: any[] = [];
  const route = loadSource('src/app/api/members/route.ts', { '@/lib/prisma': { prisma: fakePrisma(calls) } });
  const refused = await route.PUT(jsonRequest('/api/members', 'PUT', { id: 'oil', avatar: jpeg(MAX_AVATAR_BYTES + 1) }));
  assert.equal(refused.status, 400);
  assert.equal(calls.length, 0);
  const saved = await route.PUT(jsonRequest('/api/members', 'PUT', { id: 'oil', avatar: jpeg(6_000) }));
  const body = await saved.json();
  assert.equal(saved.status, 200);
  assert.equal(calls[0].select.avatar, undefined);
  assert.match(body.member.avatar, /^\/api\/members\/oil\/avatar\?v=\d+$/);
});
