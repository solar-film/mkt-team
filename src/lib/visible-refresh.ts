export interface RefreshEnvironment {
  isVisible: () => boolean;
  now: () => number;
  subscribe: (listener: () => void) => () => void;
  schedule: (listener: () => void, delay: number) => unknown;
  cancel: (handle: unknown) => void;
}

/** Keep the existing refresh frequency, without fetching from background tabs. */
export function startVisibleRefresh(
  refresh: () => unknown | Promise<unknown>,
  environment: RefreshEnvironment,
  interval = 120_000,
) {
  let disposed = false;
  let running = false;
  let timer: unknown;
  let lastRefresh = -Infinity;

  const clear = () => {
    if (timer !== undefined) environment.cancel(timer);
    timer = undefined;
  };
  const schedule = () => {
    clear();
    if (!disposed && !running && environment.isVisible()) {
      timer = environment.schedule(run, Math.max(0, interval - (environment.now() - lastRefresh)));
    }
  };
  const run = async () => {
    clear();
    if (disposed || running || !environment.isVisible()) return;
    running = true;
    lastRefresh = environment.now();
    try { await refresh(); } catch { /* The caller displays its existing error state. */ }
    finally { lastRefresh = environment.now(); running = false; schedule(); }
  };
  const onVisibility = () => {
    if (!environment.isVisible()) { clear(); return; }
    if (environment.now() - lastRefresh >= interval) void run();
    else schedule();
  };
  const unsubscribe = environment.subscribe(onVisibility);
  void run();
  return () => { disposed = true; clear(); unsubscribe(); };
}
