/** CSRF protection only; choosing a profile is deliberately not proof of identity. */
export function browserWriteRejection(request: Request): number | null {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return null;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return 403;
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  // Next's local server can normalize request.url to localhost while Host is 127.0.0.1.
  const expectedOrigin = `${url.protocol}//${request.headers.get('host') || url.host}`;
  if (origin && origin !== expectedOrigin) return 403;
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 4_300_000) return 413;
  if (request.method !== 'DELETE' && !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return 415;
  return null;
}
