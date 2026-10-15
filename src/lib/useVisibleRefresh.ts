'use client';

import { useEffect, useRef, type DependencyList } from 'react';
import { startVisibleRefresh } from './visible-refresh';

export function useVisibleRefresh(refresh: () => unknown | Promise<unknown>, dependencies: DependencyList) {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => startVisibleRefresh(() => callback.current(), {
    isVisible: () => document.visibilityState !== 'hidden',
    now: () => Date.now(),
    subscribe(listener) {
      document.addEventListener('visibilitychange', listener);
      window.addEventListener('focus', listener);
      return () => {
        document.removeEventListener('visibilitychange', listener);
        window.removeEventListener('focus', listener);
      };
    },
    schedule: (listener, delay) => window.setTimeout(listener, delay),
    cancel: handle => window.clearTimeout(handle as number),
  }), dependencies);
}
