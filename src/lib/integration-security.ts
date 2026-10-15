import { createHmac, timingSafeEqual } from 'node:crypto';

export function secretMatches(actual: string | null, expected: string): boolean {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function validLineSignature(body: string, signature: string | null, secret: string): boolean {
  return secretMatches(signature, createHmac('sha256', secret).update(body).digest('base64'));
}
