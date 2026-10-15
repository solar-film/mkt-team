export class RequestBodyError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export const MAX_JSON_BYTES = 4_300_000;

/** Bound streamed requests too, rather than trusting Content-Length alone. */
export async function readBodyText(request: Request, limit = MAX_JSON_BYTES): Promise<string> {
  if (!request.body) throw new RequestBodyError('Request body is required');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new RequestBodyError('File or request is too large', 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJsonBody(request: Request, allowArray = false): Promise<Record<string, any>> {
  const raw = await readBodyText(request);
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new RequestBodyError('Invalid JSON'); }
  if (!data || typeof data !== 'object' || (!allowArray && Array.isArray(data))) throw new RequestBodyError('Expected a JSON object');
  return data;
}
