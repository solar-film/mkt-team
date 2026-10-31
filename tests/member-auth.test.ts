import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LOCK_WINDOW_MS, MAX_IP_FAILURES, MAX_MEMBER_FAILURES, hashPin, lockedUntil, publicApi, readCookie,
  sessionMemberId, tokenHash, validPin, verifyPin, weakPin,
} from '../src/lib/member-auth';
import { loadSource, jsonRequest } from './route-harness';

type Attempt = { kind: string; memberId: string | null; success: boolean; reason: string; ip: string; createdAt: Date };
type Session = { tokenHash: string; memberId: string; expiresAt: Date; revokedAt: Date | null };

/** Just enough of Prisma for the sign-in code paths. */
function fakeDb(options: { pinHash?: string | null; status?: string } = {}) {
  const attempts: Attempt[] = [];
  const sessions: Session[] = [];
  const matches = (row: any, where: any) => Object.entries(where).every(([key, value]: [string, any]) => {
    if (value && typeof value === 'object' && 'gt' in value) return row[key] > value.gt;
    if (value && typeof value === 'object' && 'not' in value) return row[key] !== value.not;
    return row[key] === value;
  });
  const db = {
    loginAttempt: {
      findMany: async ({ where, take }: any) => attempts.filter(row => matches(row, where))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, take),
      create: async ({ data }: any) => { attempts.push({ ...data, createdAt: new Date() }); return data; },
    },
    memberSession: {
      create: async ({ data }: any) => { sessions.push({ revokedAt: null, ...data }); return data; },
      findUnique: async ({ where }: any) => {
        const found = sessions.find(row => row.tokenHash === where.tokenHash);
        return found ? { ...found, member: { status: options.status ?? 'active' } } : null;
      },
      updateMany: async ({ where, data }: any) => {
        const rows = sessions.filter(row => matches(row, where));
        rows.forEach(row => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    teamMember: {
      findUnique: async ({ where }: any) => (where.id === 'oil'
        ? { id: 'oil', status: options.status ?? 'active', credential: options.pinHash ? { pinHash: options.pinHash } : null }
        : null),
    },
  };
  return { db, attempts, sessions };
}

const loginRoute = (db: any) => loadSource('src/app/api/auth/login/route.ts', { '@/lib/prisma': { prisma: db } });
const login = (route: any, pin: string, ip = '203.0.113.5') => {
  const request = jsonRequest('/api/auth/login', 'POST', { memberId: 'oil', pin });
  request.headers.set('x-forwarded-for', ip);
  return route.POST(request);
};

test('PINs must be six digits and not trivially guessable', () => {
  assert.equal(validPin('482915'), true);
  assert.equal(validPin('48291'), false);
  assert.equal(validPin('48291a'), false);
  assert.equal(validPin(482915), false);
  for (const weak of ['000000', '777777', '123456', '654321', '890123', '345678']) assert.equal(weakPin(weak), true, weak);
  for (const fine of ['482915', '112233', '135790']) assert.equal(weakPin(fine), false, fine);
});

test('PIN hashes are salted, verify only the right PIN, and never match without a stored hash', async () => {
  const first = await hashPin('482915');
  const second = await hashPin('482915');
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /482915/);
  assert.equal(await verifyPin('482915', first), true);
  assert.equal(await verifyPin('482916', first), false);
  assert.equal(await verifyPin('482915', null), false);
  assert.equal(await verifyPin('', undefined), false);
});

test('only sign-in, admin and avatar images are reachable without a member session', () => {
  assert.equal(publicApi('/api/auth/login', 'POST'), true);
  assert.equal(publicApi('/api/admin/member-pins', 'POST'), true);
  assert.equal(publicApi('/api/members/oil/avatar', 'GET'), true);
  assert.equal(publicApi('/api/members/oil/avatar', 'PUT'), false);
  for (const path of ['/api/members', '/api/tasks', '/api/dashboard', '/api/company-stats', '/api/authx', '/api/content']) {
    assert.equal(publicApi(path, 'GET'), false, path);
  }
});

test('session cookies are read strictly', () => {
  const token = 'a'.repeat(43);
  assert.equal(readCookie(new Request('http://x/', { headers: { cookie: `other=1; mkt_session=${token}` } }), 'mkt_session'), token);
  assert.equal(readCookie(new Request('http://x/', { headers: { cookie: 'mkt_session=short' } }), 'mkt_session'), null);
  assert.equal(readCookie(new Request('http://x/', { headers: { cookie: 'mkt_session=bad;value' } }), 'mkt_session'), null);
});

test('a wrong PIN is refused and logged; five failures lock the member even with the right PIN', async () => {
  const { db, attempts } = fakeDb({ pinHash: await hashPin('482915') });
  const route = loginRoute(db);
  for (let i = 0; i < MAX_MEMBER_FAILURES; i++) assert.equal((await login(route, '000001', `198.51.100.${i}`)).status, 401);
  assert.equal(attempts.filter(row => !row.success && row.reason === 'wrong pin').length, MAX_MEMBER_FAILURES);
  const locked = await login(route, '482915');
  assert.equal(locked.status, 429);
  assert.match((await locked.json()).error, /ลองใหม่ได้ในอีก 15 นาที/);
  assert.equal(locked.headers.get('set-cookie'), null);
});

test('the right PIN signs in with an HttpOnly cookie whose token is stored only as a hash', async () => {
  const { db, sessions, attempts } = fakeDb({ pinHash: await hashPin('482915') });
  const response = await login(loginRoute(db), '482915');
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie') || '';
  assert.match(cookie, /^mkt_session=[A-Za-z0-9_-]{43};/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Max-Age=2592000/);
  const token = cookie.split(';')[0].split('=')[1];
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].tokenHash, tokenHash(token));
  assert.notEqual(sessions[0].tokenHash, token);
  assert.equal(attempts.at(-1)?.success, true);
});

test('members without a PIN, unknown or inactive members cannot sign in', async () => {
  const noPin = fakeDb({ pinHash: null });
  assert.equal((await login(loginRoute(noPin.db), '482915')).status, 401);
  assert.equal(noPin.attempts[0].reason, 'no pin');
  const inactive = fakeDb({ pinHash: await hashPin('482915'), status: 'inactive' });
  assert.equal((await login(loginRoute(inactive.db), '482915')).status, 401);
  assert.equal(inactive.sessions.length, 0);
});

test('a success clears earlier member failures; one address is locked after many failures across members', async () => {
  const { db, attempts } = fakeDb();
  const now = Date.now();
  const at = (offset: number) => new Date(now - offset);
  for (let i = 0; i < MAX_MEMBER_FAILURES; i++) attempts.push({ kind: 'member', memberId: 'oil', success: false, reason: 'wrong pin', ip: 'a', createdAt: at(60_000 + i) });
  attempts.push({ kind: 'member', memberId: 'oil', success: true, reason: 'ok', ip: 'a', createdAt: at(1_000) });
  assert.equal(await lockedUntil(db as any, { kind: 'member', memberId: 'oil', ip: 'b' }, now), null);

  for (let i = 0; i < MAX_IP_FAILURES; i++) attempts.push({ kind: 'member', memberId: `m${i}`, success: false, reason: 'wrong pin', ip: 'c', createdAt: at(2_000 + i) });
  const until = await lockedUntil(db as any, { kind: 'member', memberId: 'new', ip: 'c' }, now);
  assert.ok(until && until.getTime() > now && until.getTime() <= now + LOCK_WINDOW_MS);
  // Failures older than the window no longer count.
  assert.equal(await lockedUntil(db as any, { kind: 'member', memberId: 'new', ip: 'c' }, now + LOCK_WINDOW_MS + 60_000), null);
});

test('sessions stop working once revoked, expired, or the member is deactivated', async () => {
  const live = fakeDb();
  live.sessions.push({ tokenHash: tokenHash('t'.repeat(43)), memberId: 'oil', expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
  assert.equal(await sessionMemberId(live.db as any, 't'.repeat(43)), 'oil');
  live.sessions.push({ tokenHash: tokenHash('r'.repeat(43)), memberId: 'oil', expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() });
  assert.equal(await sessionMemberId(live.db as any, 'r'.repeat(43)), null);
  live.sessions.push({ tokenHash: tokenHash('e'.repeat(43)), memberId: 'oil', expiresAt: new Date(Date.now() - 1), revokedAt: null });
  assert.equal(await sessionMemberId(live.db as any, 'e'.repeat(43)), null);
  assert.equal(await sessionMemberId(live.db as any, null), null);
  const inactive = fakeDb({ status: 'inactive' });
  inactive.sessions.push({ tokenHash: tokenHash('i'.repeat(43)), memberId: 'oil', expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
  assert.equal(await sessionMemberId(inactive.db as any, 'i'.repeat(43)), null);
});

test('signing out revokes the session in the database and clears the cookie', async () => {
  const { db, sessions } = fakeDb();
  const token = 'L'.repeat(43);
  sessions.push({ tokenHash: tokenHash(token), memberId: 'oil', expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
  const route = loadSource('src/app/api/auth/logout/route.ts', { '@/lib/prisma': { prisma: db } });
  const response = await route.POST(new Request('http://localhost/api/auth/logout', { method: 'POST', headers: { cookie: `mkt_session=${token}` } }));
  assert.equal(response.status, 200);
  assert.ok(sessions[0].revokedAt);
  assert.match(response.headers.get('set-cookie') || '', /mkt_session=;.*Max-Age=0/);
});
