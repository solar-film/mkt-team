import { FIRST_REVIEW, type FirstReview } from '@/lib/work-review';

/**
 * มะลิ (AI) reads finished work that the Admin has not reviewed yet, checks it against these
 * criteria and sends back a suggestion. The suggestion is shown in the review panel; only the
 * Admin sets the real first review (user decision 2 Nov 69: AI แนะนำ, Admin ตัดสิน).
 */
export const AI_REVIEW_CRITERIA = [
  'ตรงตามบรีฟ: ทำครบตามรายละเอียดงานที่สั่ง',
  'ตรงโทนแบรนด์: ภาษาและภาพตรงกับแบรนด์ GFS / MHL / MHL CAR ของงานนั้น',
  'ไม่มีคำผิดหรือข้อมูลผิด: สะกดถูก ราคาและข้อมูลสินค้าถูกต้อง',
  'มีลิงก์งานเปิดดูได้: ลิงก์แนบเปิดได้และเป็นชิ้นงานจริง',
] as const;

/** Finished work older than this is not offered for an AI check. */
export const AI_QUEUE_DAYS = 45;
export const MAX_AI_REVIEWS = 100;
const MAX_NOTE = 2000;

export class AiReviewInputError extends Error {}

export interface AiReviewInput {
  kind: 'task' | 'content';
  id: string;
  suggestion: FirstReview;
  note: string;
}

/** Body from มะลิ: { reviews: [{ kind, id, suggestion: 'pass' | 'revise', note }] }. */
export function parseAiReviews(body: Record<string, unknown>): AiReviewInput[] {
  if (!Array.isArray(body.reviews) || body.reviews.length === 0 || body.reviews.length > MAX_AI_REVIEWS) {
    throw new AiReviewInputError(`reviews must be a list of 1-${MAX_AI_REVIEWS} entries`);
  }
  const seen = new Set<string>();
  return body.reviews.map((raw: unknown, index: number) => {
    if (!raw || typeof raw !== 'object') throw new AiReviewInputError(`reviews[${index}] is invalid`);
    const entry = raw as Record<string, unknown>;
    const kind = entry.kind === 'task' || entry.kind === 'content' ? entry.kind : null;
    if (!kind) throw new AiReviewInputError(`reviews[${index}].kind must be task or content`);
    const id = typeof entry.id === 'string' && entry.id.length > 0 && entry.id.length <= 64 ? entry.id : '';
    if (!id) throw new AiReviewInputError(`reviews[${index}].id is invalid`);
    if (seen.has(`${kind}:${id}`)) throw new AiReviewInputError(`reviews[${index}]: ${kind} ${id} appears twice`);
    seen.add(`${kind}:${id}`);
    const suggestion = typeof entry.suggestion === 'string' && entry.suggestion in FIRST_REVIEW ? (entry.suggestion as FirstReview) : null;
    if (!suggestion) throw new AiReviewInputError(`reviews[${index}].suggestion must be pass or revise`);
    const note = typeof entry.note === 'string' ? entry.note.trim().slice(0, MAX_NOTE) : '';
    if (!note) throw new AiReviewInputError(`reviews[${index}].note (the reason) is required`);
    return { kind, id, suggestion, note };
  });
}
