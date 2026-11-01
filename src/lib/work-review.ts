/**
 * Work review fields used by KPI กลาง: when work was handed in, whether it was held up by
 * someone else, the first review result and, for content, organic or paid. All optional;
 * work recorded before November 2569 simply has none of them.
 */
export const FIRST_REVIEW = { pass: 'ผ่าน', revise: 'แก้' } as const;
export const REVISE_REASON = { quality: 'คุณภาพ', brief: 'เปลี่ยนบรีฟ' } as const;
export const PROMOTION = { organic: 'Organic', paid: 'Paid' } as const;

export type FirstReview = keyof typeof FIRST_REVIEW;
export type ReviseReason = keyof typeof REVISE_REASON;
export type Promotion = keyof typeof PROMOTION;

export interface WorkReview {
  submittedAt?: Date | null;
  waitingOn?: string | null;
  firstReview?: FirstReview | null;
  reviseReason?: ReviseReason | null;
  promotion?: Promotion | null;
}

export class WorkReviewError extends Error {}

function choice<T extends string>(value: unknown, options: Record<T, string>, label: string): T | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'string' && value in options) return value as T;
  throw new WorkReviewError(`${label} ไม่ถูกต้อง`);
}

/** Validates a review update. Missing keys are left unchanged; null or '' clears a field. */
export function parseWorkReview(body: Record<string, unknown>, kind: 'task' | 'content'): WorkReview {
  const review: WorkReview = {};
  if (body.submittedAt !== undefined) {
    if (body.submittedAt === null || body.submittedAt === '') review.submittedAt = null;
    else {
      const date = new Date(String(body.submittedAt));
      if (Number.isNaN(date.getTime())) throw new WorkReviewError('วันส่งจริงไม่ถูกต้อง');
      review.submittedAt = date;
    }
  }
  if (body.waitingOn !== undefined) {
    if (body.waitingOn !== null && typeof body.waitingOn !== 'string') throw new WorkReviewError('สถานะรอไม่ถูกต้อง');
    review.waitingOn = body.waitingOn?.trim().slice(0, 200) || null;
  }
  review.firstReview = choice(body.firstReview, FIRST_REVIEW, 'ผลตรวจรอบแรก');
  review.reviseReason = choice(body.reviseReason, REVISE_REASON, 'สาเหตุการแก้');
  // A reason only makes sense for work that had to be revised.
  if (review.firstReview === 'pass' || review.firstReview === null) review.reviseReason = null;
  if (kind === 'content') review.promotion = choice(body.promotion, PROMOTION, 'Organic/Paid');
  for (const key of Object.keys(review) as (keyof WorkReview)[]) if (review[key] === undefined) delete review[key];
  return review;
}

/**
 * Hand-in time follows the status: moving to "done" stamps it (unless already set), moving
 * back out clears it so the work is timed again when it is finished for real.
 */
export function submittedAtForStatus(before: { status: string; submittedAt: Date | null }, nextStatus: string | undefined, now = new Date()): Date | null | undefined {
  if (nextStatus === undefined || nextStatus === before.status) return undefined;
  if (nextStatus === 'done') return before.submittedAt ?? now;
  if (before.status === 'done') return null;
  return undefined;
}
