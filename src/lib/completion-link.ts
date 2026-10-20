import { isContentDone } from './dashboard-items';
import { parseKpiIds } from './task-kpi';

export type WorkKind = 'task' | 'content';
type WorkState = { status?: string | null; kpiId?: string | null; link?: string | null };

export const COMPLETION_LINK_MESSAGE = 'ต้องใส่ลิงก์ผลงานก่อนเปลี่ยนเป็นเสร็จแล้ว (คอนเทนต์ทุกชิ้น และงานที่ผูก KPI)';

/** Content always needs a link to be completed; a task only when it counts towards a KPI. */
export function requiresLinkToComplete(kind: WorkKind, kpiId: unknown): boolean {
  return kind === 'content' || parseKpiIds(kpiId).length > 0;
}

export function isCompleted(kind: WorkKind, status: unknown): boolean {
  if (typeof status !== 'string') return false;
  return kind === 'content' ? isContentDone(status) : status === 'done' || status === 'เสร็จแล้ว';
}

export const hasLink = (link: unknown) => typeof link === 'string' && link.trim() !== '';

export function missingCompletionLink(kind: WorkKind, state: WorkState): boolean {
  return isCompleted(kind, state.status) && requiresLinkToComplete(kind, state.kpiId) && !hasLink(state.link);
}

/**
 * Server rule for a save: refuse only when this save would create a completed item without its link.
 * Records that were already completed without a link before this rule are left editable.
 */
export function blocksCompletion(kind: WorkKind, before: WorkState | null, after: WorkState): boolean {
  if (!missingCompletionLink(kind, after)) return false;
  return !(before && missingCompletionLink(kind, before));
}
