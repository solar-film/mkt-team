const IDEA_DONE = ['เสร็จแล้ว', 'เสร็จสิ้น', 'done', 'completed', 'approved'];
const IDEA_TODO = ['รอดำเนินการ', 'pending', 'todo'];

/** Board column for an idea. The idea pane saves "เสร็จสิ้น" while the board saves "เสร็จแล้ว". */
export function ideaBoardStatus(status: string | null | undefined): 'todo' | 'in_progress' | 'done' {
  if (!status || IDEA_TODO.includes(status)) return 'todo';
  if (IDEA_DONE.includes(status)) return 'done';
  return 'in_progress';
}

/** Content ticked in older meeting screens is stored as "published"; it counts as done everywhere. */
export function isContentDone(status: string | null | undefined): boolean {
  return status === 'done' || status === 'published' || status === 'เสร็จแล้ว';
}

export function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const records = new Map<string, T>();
  for (const item of items) {
    if (!records.has(item.id)) records.set(item.id, item);
  }
  return [...records.values()];
}
