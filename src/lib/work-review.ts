/**
 * Work facts used by KPI กลาง.
 *
 * - Hand-in time (submittedAt) is set by the system only: the real post time when the post is
 *   found on Facebook/TikTok (see facebook-sync / tiktok-sync), otherwise the moment the work is
 *   marked done. Nobody types it (user decision 2 Nov 69).
 * - Organic/Paid and Reach @7 วัน for channels without automatic figures are typed on the
 *   รายงานรวม page.
 *
 * The first review, its reason, "waiting on" and the AI suggestion were removed on 2 Nov 69;
 * their old values stay in the database but nothing reads or writes them any more.
 */
export const PROMOTION = { organic: 'Organic', paid: 'Paid' } as const;

export type Promotion = keyof typeof PROMOTION;

export interface WorkReview {
  promotion?: Promotion | null;
}

export class WorkReviewError extends Error {}

function choice<T extends string>(value: unknown, options: Record<T, string>, label: string): T | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'string' && value in options) return value as T;
  throw new WorkReviewError(`${label} ไม่ถูกต้อง`);
}

/** Validates an update of Organic/Paid (content only). A missing key is left unchanged; null or '' clears it. */
export function parseWorkReview(body: Record<string, unknown>, kind: 'task' | 'content'): WorkReview {
  const review: WorkReview = {};
  if (kind === 'content') {
    const promotion = choice(body.promotion, PROMOTION, 'Organic/Paid');
    if (promotion !== undefined) review.promotion = promotion;
  }
  return review;
}

const MAX_REACH = 2_147_483_647;

/**
 * Reach @7 วัน typed on the รายงานรวม page (content only). It lives in ContentMetric D+7,
 * not on the content row, so it is parsed apart from parseWorkReview.
 * undefined = leave as is, null = clear, otherwise a whole number of people.
 */
export function parseReach7(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  const text = typeof value === 'string' ? value.replace(/,/g, '').trim() : null;
  if (value === null || text === '') return null;
  const reach = text === null ? value : /^\d+$/.test(text) ? Number(text) : NaN;
  if (typeof reach !== 'number' || !Number.isInteger(reach) || reach < 0 || reach > MAX_REACH) {
    throw new WorkReviewError('Reach @7 วัน ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
  }
  return reach;
}

/**
 * Hand-in time follows the status: moving to "done" stamps it (unless a post time is already
 * set), moving back out clears it so the work is timed again when it is finished for real.
 */
export function submittedAtForStatus(before: { status: string; submittedAt: Date | null }, nextStatus: string | undefined, now = new Date()): Date | null | undefined {
  if (nextStatus === undefined || nextStatus === before.status) return undefined;
  if (nextStatus === 'done') return before.submittedAt ?? now;
  if (before.status === 'done') return null;
  return undefined;
}
