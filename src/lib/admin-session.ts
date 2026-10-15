import { createHmac } from 'node:crypto';
import { secretMatches } from './integration-security';

export const ADMIN_COOKIE = 'mkt_admin_session';
export const ADMIN_SESSION_SECONDS = 3600;
export const adminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

const signature = (expires: string) => createHmac('sha256', process.env.ADMIN_PASSWORD!)
  .update(`mkt-admin:${expires}`).digest('base64url');

export function createAdminSession() {
  const expires = String(Date.now() + ADMIN_SESSION_SECONDS * 1000);
  return `${expires}.${signature(expires)}`;
}

export function hasAdminSession(request: Request): boolean {
  if (!adminConfigured()) return false;
  const token = request.headers.get('cookie')?.split(';').map(value => value.trim())
    .find(value => value.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  if (!token) return false;
  const [expires, signed, extra] = token.split('.');
  if (extra || !/^\d{13}$/.test(expires) || Number(expires) <= Date.now() ||
      Number(expires) > Date.now() + ADMIN_SESSION_SECONDS * 1000) return false;
  return secretMatches(signed, signature(expires));
}
