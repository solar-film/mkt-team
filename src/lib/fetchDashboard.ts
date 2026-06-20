let globalDashboardPromise: Promise<Response> | null = null;
let globalDashboardPromiseTime = 0;

export const fetchDashboardCached = (url: string) => {
  // Only cache the main dashboard endpoint without specific filters
  if (url !== '/api/dashboard' && url !== '/api/dashboard?memberId=all') {
    return fetch(url, { cache: 'no-store' });
  }

  const now = Date.now();
  // Cache the promise for 2 seconds to deduplicate simultaneous requests
  if (globalDashboardPromise && (now - globalDashboardPromiseTime < 2000)) {
    return globalDashboardPromise.then(res => res.clone());
  }

  globalDashboardPromise = fetch(url, { cache: 'no-store' });
  globalDashboardPromiseTime = now;
  
  return globalDashboardPromise.then(res => res.clone());
};
