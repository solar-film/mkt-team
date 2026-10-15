let revision = 0;
let freshUntil = 0;

export const workspaceRevision = () => revision;

/** Saves are followed by a fresh read even while distributed invalidation settles. */
export async function fetchWorkspace(input: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const ownApi = input.startsWith('/api/');
  let url = input;
  if (ownApi && method === 'GET' && Date.now() < freshUntil) {
    url += `${url.includes('?') ? '&' : '?'}fresh=1`;
  }
  const response = await fetch(url, init);
  if (ownApi && !['GET', 'HEAD', 'OPTIONS'].includes(method) && response.ok) {
    revision++;
    freshUntil = Date.now() + 5_000;
  }
  return response;
}
