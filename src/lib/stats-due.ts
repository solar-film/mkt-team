import { bangkokDateKey } from './bangkok-date';
import { isContentDone } from './dashboard-items';
import { parseSelection } from './assignments';

/** Statistics are expected for content published from this Thai calendar day onwards. */
export const STATS_TRACKING_START = '2026-10-01';
/** The same moment as a UTC timestamp, for database filters (00:00 in Bangkok = 17:00 UTC the day before). */
export const STATS_TRACKING_START_UTC = new Date('2026-09-30T17:00:00.000Z');

export const STAT_SNAPSHOTS = [
  { key: 'D+7', days: 7 },
  { key: 'D+15', days: 15 },
  { key: 'D+30', days: 30 },
] as const;

export type StatsContent = {
  id: string; title: string; status?: string | null; publishDate?: string | Date | null;
  memberId?: string | null; memberIds?: string[] | null; platform?: string | null; company?: string | null;
  metrics?: { snapshot: string }[] | null;
};

export type PendingStat = {
  contentId: string; title: string; snapshot: string; dueDate: string; daysOverdue: number;
  ownerIds: string[]; platform: string | null; company: string | null; publishDate: string;
};

const DAY = 86_400_000;
const dayNumber = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY;
};
const keyFromDayNumber = (value: number) => new Date(value * DAY).toISOString().slice(0, 10);

export function contentOwnerIds(content: StatsContent): string[] {
  const ids = parseSelection(content.memberIds?.length ? content.memberIds : content.memberId);
  return ids;
}

/** Whether one snapshot of a content item is due today (Thai time) and how many days late it is. */
export function snapshotDue(content: StatsContent, days: number, now = new Date()): { due: boolean; daysOverdue: number; dueDate: string } {
  const published = content.publishDate ? bangkokDateKey(content.publishDate) : '';
  if (!published) return { due: false, daysOverdue: 0, dueDate: '' };
  const dueDay = dayNumber(published) + days;
  const today = dayNumber(bangkokDateKey(now));
  return { due: today >= dueDay, daysOverdue: Math.max(0, today - dueDay), dueDate: keyFromDayNumber(dueDay) };
}

/** Published content in the tracking period that still lacks a snapshot it is due for, most overdue first. */
export function pendingStats(contents: readonly StatsContent[], now = new Date()): PendingStat[] {
  const items: PendingStat[] = [];
  for (const content of contents) {
    if (!content.publishDate || !isContentDone(content.status)) continue;
    const published = bangkokDateKey(content.publishDate);
    if (!published || published < STATS_TRACKING_START) continue;
    const recorded = new Set((content.metrics || []).map(metric => metric.snapshot));
    for (const snapshot of STAT_SNAPSHOTS) {
      if (recorded.has(snapshot.key)) continue;
      const due = snapshotDue(content, snapshot.days, now);
      if (!due.due) continue;
      items.push({
        contentId: content.id, title: content.title, snapshot: snapshot.key, dueDate: due.dueDate, daysOverdue: due.daysOverdue,
        ownerIds: contentOwnerIds(content), platform: content.platform || null, company: content.company || null, publishDate: published,
      });
    }
  }
  const order = (key: string) => STAT_SNAPSHOTS.findIndex(snapshot => snapshot.key === key);
  return items.sort((a, b) => b.daysOverdue - a.daysOverdue || order(a.snapshot) - order(b.snapshot) || a.title.localeCompare(b.title));
}

/** Items belonging to one person; content assigned to everyone belongs to every person. */
export function pendingStatsFor(items: readonly PendingStat[], memberId: string): PendingStat[] {
  if (!memberId || memberId === 'all') return [...items];
  return items.filter(item => item.ownerIds.includes(memberId) || item.ownerIds.includes('all'));
}

/** LINE reminder section: one line per owner with pending counts per snapshot, most overdue owner first. */
export function statsReminderText(items: readonly PendingStat[], names: ReadonlyMap<string, string>): string {
  const owners = new Map<string, { counts: Map<string, number>; maxOverdue: number }>();
  for (const item of items) {
    const ownerIds = item.ownerIds.length ? item.ownerIds : [''];
    for (const ownerId of ownerIds) {
      const label = ownerId === 'all' ? 'ทุกคน' : names.get(ownerId) || 'ไม่ระบุ';
      const entry = owners.get(label) || { counts: new Map<string, number>(), maxOverdue: 0 };
      entry.counts.set(item.snapshot, (entry.counts.get(item.snapshot) || 0) + 1);
      entry.maxOverdue = Math.max(entry.maxOverdue, item.daysOverdue);
      owners.set(label, entry);
    }
  }
  const lines = [...owners.entries()]
    .sort((a, b) => b[1].maxOverdue - a[1].maxOverdue || a[0].localeCompare(b[0]))
    .map(([label, entry]) => {
      const counts = STAT_SNAPSHOTS.filter(snapshot => entry.counts.has(snapshot.key))
        .map(snapshot => `${snapshot.key} ${entry.counts.get(snapshot.key)}`).join(', ');
      return `- ${label}: ${counts}${entry.maxOverdue > 0 ? ` (เลยกำหนดสุด ${entry.maxOverdue} วัน)` : ''}`;
    });
  return `📊 *สถิติคอนเทนต์ที่ต้องกรอก ${items.length} รายการ:*\n${lines.join('\n')}\nกรอกได้ที่เมนู สถิติคอนเทนต์ > บันทึกสถิติ`;
}
