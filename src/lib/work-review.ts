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

/** Only this role may set the first review result (user decision 2 Nov 69: Admin เท่านั้น). */
export const REVIEWER_ROLE = 'Admin';

/**
 * True when an update would change the stored first review or its reason. The panel sends
 * these fields on every save, so an unchanged value from a non-Admin is not a change.
 */
export function changesFirstReview(
  before: { firstReview: string | null; reviseReason: string | null },
  update: WorkReview
): boolean {
  const nextFirst = update.firstReview === undefined ? before.firstReview : update.firstReview;
  const nextReason = update.reviseReason === undefined ? before.reviseReason : update.reviseReason;
  return nextFirst !== before.firstReview || nextReason !== before.reviseReason;
}

const MAX_REACH = 2_147_483_647;

/**
 * Reach @7 วัน typed into the review panel (content only). It lives in ContentMetric D+7,
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
 * Hand-in time follows the status: moving to "done" stamps it (unless already set), moving
 * back out clears it so the work is timed again when it is finished for real.
 */
export function submittedAtForStatus(before: { status: string; submittedAt: Date | null }, nextStatus: string | undefined, now = new Date()): Date | null | undefined {
  if (nextStatus === undefined || nextStatus === before.status) return undefined;
  if (nextStatus === 'done') return before.submittedAt ?? now;
  if (before.status === 'done') return null;
  return undefined;
}
