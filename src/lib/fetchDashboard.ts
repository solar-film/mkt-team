import { fetchWorkspace, workspaceRevision } from '@/lib/workspace-fetch';

const pending = new Map<string, Promise<Response>>();

// Deduplicate simultaneous reads only, so completed reads cannot hide a subsequent save.
export const fetchDashboardCached = (url: string) => {
  const key = `${url === '/api/dashboard?memberId=all' ? '/api/dashboard' : url}|${workspaceRevision()}`;
  let request = pending.get(key);
  if (!request) {
    request = fetchWorkspace(url, { cache: 'no-store' });
    pending.set(key, request);
    void request.finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    }).catch(() => {});
  }
  return request.then(response => response.clone());
};
