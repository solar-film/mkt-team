import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

/** Runs a form submit handler once at a time, so a double click cannot save the same item twice. */
export function useSubmitGuard() {
  const busyRef = useRef(false);
  const [saving, setSaving] = useState(false);

  const guard = (handler: (e: FormEvent) => Promise<void> | void) => async (e: FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    try {
      await handler(e);
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  return { saving, guard };
}
