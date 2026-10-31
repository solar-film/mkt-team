import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export const MEMBER_COOKIE = 'mkt_session';
/** Set by the proxy after it checks the session; any value sent by a browser is removed first. */
export const MEMBER_HEADER = 'x-mkt-member-id';
export const SESSION_SECONDS = 30 * 24 * 3600;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;
export const MAX_MEMBER_FAILURES = 5;
export const MAX_ADMIN_FAILURES = 5;
export const MAX_IP_FAILURES = 20;
// Other server instances may honour a revoked session for at most this long.
const SESSION_CACHE_MS = 30_000;

// The admin page has its own password; every other page needs a member session.
export const PUBLIC_PAGES = new Set(['/login', '/admin', '/manifest.webmanifest']);

/** Sign-in, admin (own password), and the avatars shown on the sign-in screen. */
export function publicApi(pathname: string, method: string): boolean {
  return pathname.startsWith('/api/auth/') || pathname.startsWith('/api/admin/') ||
    (method === 'GET' && /^\/api\/members\/[^/]+\/avatar$/.test(pathname));
}

type AuthDb =Pick<PrismaClient, 'memberSession' | 'loginAttempt'>;

const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 32;

const derive = (pin: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => {
  scrypt(pin, salt, KEY_LENGTH, SCRYPT, (error, key) => (error ? reject(error) : resolve(key)));
});

export function validPin(value: unknown): value is string {
  return typeof value === 'string' && /^\d{6}$/.test(value);
}

/** Rejects PINs anyone would try first: one repeated digit or a straight run. */
export function weakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true;
  const steps = new Set([...pin].slice(1).map((digit, i) => (Number(digit) - Number(pin[i]) + 10) % 10));
  return steps.size === 1 && (steps.has(1) || steps.has(9));
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(pin, salt);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

// Members without a PIN still cost one hash, so response time does not reveal who has one.
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(KEY_LENGTH).toString('base64url')}`;

export async function verifyPin(pin: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, salt, expected] = (stored || DUMMY_HASH).split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const key = await derive(pin, Buffer.from(salt, 'base64url'));
  const wanted = Buffer.from(expected, 'base64url');
  return Boolean(stored) && wanted.length === key.length && timingSafeEqual(key, wanted);
}

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export function readCookie(request: Request, name: string): string | null {
  const value = request.headers.get('cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{20,100}$/.test(value) ? value : null;
}

/** Vercel overwrites x-forwarded-for with the real client address. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || request.headers.get('x-real-ip') || '').slice(0, 64);
}

export const userAgentOf = (request: Request) => request.headers.get('user-agent')?.slice(0, 300) || null;

export const sessionCookieOptions = (maxAge = SESSION_SECONDS) => ({
  httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge,
});

export type LockScope = { kind: 'member' | 'admin'; memberId?: string | null; ip: string };

/** Returns when the lock lifts, or null. Failures before the last success do not count. */
export async function lockedUntil(db: AuthDb, scope: LockScope, now = Date.now()): Promise<Date | null> {
  const since = new Date(now - LOCK_WINDOW_MS);
  const limit = scope.kind === 'admin' ? MAX_ADMIN_FAILURES : MAX_MEMBER_FAILURES;
  const until = (failures: { createdAt: Date }[], max: number) =>
    failures.length >= max ? new Date(failures[max - 1].createdAt.getTime() + LOCK_WINDOW_MS) : null;

  const accountWhere = scope.kind === 'admin'
    ? { kind: 'admin', ip: scope.ip }
    : { kind: 'member', memberId: scope.memberId ?? '' };
  const recent = await db.loginAttempt.findMany({
    where: { ...accountWhere, createdAt: { gt: since } },
    orderBy: { createdAt: 'desc' }, select: { success: true, createdAt: true }, take: 50,
  });
  const lastSuccess = recent.findIndex(attempt => attempt.success);
  const accountLock = until((lastSuccess === -1 ? recent : recent.slice(0, lastSuccess)), limit);
  if (accountLock) return accountLock;

  if (!scope.ip) return null;
  const fromIp = await db.loginAttempt.findMany({
    where: { ip: scope.ip, success: false, createdAt: { gt: since } },
    orderBy: { createdAt: 'desc' }, select: { createdAt: true }, take: MAX_IP_FAILURES,
  });
  return until(fromIp, MAX_IP_FAILURES);
}

export async function recordAttempt(db: AuthDb, request: Request, data: { kind: 'member' | 'admin'; memberId?: string | null; success: boolean; reason: string }) {
  try {
    await db.loginAttempt.create({ data: { ...data, memberId: data.memberId ?? null, ip: clientIp(request), userAgent: userAgentOf(request) } });
  } catch (error) {
    // A failed log write must not block sign-in, but it should be visible in server logs.
    console.error('Login attempt was not recorded:', error instanceof Error ? error.message : 'unknown error');
  }
}

export async function createSession(db: AuthDb, memberId: string, request: Request) {
  const token = randomBytes(32).toString('base64url');
  await db.memberSession.create({ data: {
    tokenHash: tokenHash(token), memberId, userAgent: userAgentOf(request),
    expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
  } });
  return token;
}

const sessionCache = new Map<string, { memberId: string; until: number }>();

export async function sessionMemberId(db: AuthDb, token: string | null, now = Date.now()): Promise<string | null> {
  if (!token) return null;
  const hash = tokenHash(token);
  const cached = sessionCache.get(hash);
  if (cached && cached.until > now) return cached.memberId;
  sessionCache.delete(hash);
  const session = await db.memberSession.findUnique({
    where: { tokenHash: hash },
    select: { memberId: true, expiresAt: true, revokedAt: true, member: { select: { status: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= now || session.member.status === 'inactive') return null;
  if (sessionCache.size > 500) sessionCache.clear();
  sessionCache.set(hash, { memberId: session.memberId, until: Math.min(now + SESSION_CACHE_MS, session.expiresAt.getTime()) });
  return session.memberId;
}

export async function revokeSession(db: AuthDb, token: string | null) {
  if (!token) return;
  const hash = tokenHash(token);
  sessionCache.delete(hash);
  await db.memberSession.updateMany({ where: { tokenHash: hash, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Signs a member out everywhere, optionally keeping the session that made the change. */
export async function revokeMemberSessions(db: AuthDb, memberId: string, keepToken?: string | null) {
  for (const [hash, entry] of sessionCache) if (entry.memberId === memberId) sessionCache.delete(hash);
  await db.memberSession.updateMany({
    where: { memberId, revokedAt: null, ...(keepToken ? { tokenHash: { not: tokenHash(keepToken) } } : {}) },
    data: { revokedAt: new Date() },
  });
}

export const lockMessage = (until: Date, now = Date.now()) =>
  `ใส่ผิดหลายครั้ง ลองใหม่ได้ในอีก ${Math.max(1, Math.ceil((until.getTime() - now) / 60_000))} นาที`;
