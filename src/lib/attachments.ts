const MAX_FILE_BYTES = 3 * 1024 * 1024;

export function decodeAttachment(url: unknown): { bytes: Buffer; type: string } | null {
  if (typeof url !== 'string') return null;
  const match = /^data:([\w.+/-]*);base64,([A-Za-z0-9+/]*={0,2})$/.exec(url);
  if (!match || match[2].length % 4 !== 0) return null;
  return { type: match[1] || 'application/octet-stream', bytes: Buffer.from(match[2], 'base64') };
}

export function validAttachment(name: unknown, type: unknown, url: unknown): boolean {
  if (typeof name !== 'string' || !name.trim() || name.length > 255 || typeof type !== 'string') return false;
  const decoded = decodeAttachment(url);
  // Never accept executable URLs or HTML/SVG pretending to be an image.
  if (!decoded || decoded.bytes.length > MAX_FILE_BYTES || (type && type !== decoded.type)) return false;
  if (decoded.type.startsWith('image/')) {
    const b = decoded.bytes;
    if (decoded.type === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    if (decoded.type === 'image/png') return b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if (decoded.type === 'image/gif') return /^GIF8[79]a$/.test(b.subarray(0, 6).toString());
    if (decoded.type === 'image/webp') return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
    return false;
  }
  return true; // Other files are always downloaded with octet-stream and nosniff.
}

export function attachmentMetadata<T extends { id: string; name: string; type: string; url: string }>(file: T, ideaId: string) {
  return { ...file, url: `/api/ideas/${ideaId}/attachments?attachmentId=${encodeURIComponent(file.id)}` };
}
