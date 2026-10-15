import { unstable_cache, revalidateTag } from 'next/cache';

const WORKSPACE_TAG = 'mkt-workspace-v1';

// Internal query cache only. Responses must never enter a shared public CDN cache.
export function cachedWorkspaceRead<T>(key: string[], read: () => Promise<T>): Promise<T> {
  return unstable_cache(read, [WORKSPACE_TAG, JSON.stringify(key)], { revalidate: 120, tags: [WORKSPACE_TAG] })();
}

export function invalidateWorkspace() {
  // A successful save must be visible on the very next GET, including in other pages.
  revalidateTag(WORKSPACE_TAG, { expire: 0 });
}

/** Cache only successful bounded JSON payloads, keyed by every supported filter. */
export async function cachedJsonRead(key: string[], read: () => Promise<Response>, fresh = false): Promise<Response> {
  if (fresh) {
    invalidateWorkspace();
    const response = await read();
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  try {
    const result = await cachedWorkspaceRead(key, async () => {
      const response = await read();
      const body = await response.text();
      // Oversized payloads and errors still reach the caller, but never fill the cache.
      if (!response.ok || Buffer.byteLength(body) > 1_500_000) {
        throw new Response(body, { status: response.status, headers: response.headers });
      }
      return { body, status: response.status };
    });
    return new Response(result.body, { status: result.status, headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
    } });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
