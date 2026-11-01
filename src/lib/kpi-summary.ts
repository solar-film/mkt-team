import { bangkokDateKey } from '@/lib/bangkok-date';

/**
 * Monthly KPI กลาง numbers per member, worked out from tasks and contents in the app.
 * No money: advertising or sales figures never enter this module.
 *
 * - ส่งตรงเวลา: work due this month (up to today) handed in on or before its due day,
 *   leaving out work held up by someone else (waitingOn).
 * - ผ่านบรีฟรอบแรก: reviewed work that passed first time; a revision caused by a changed
 *   brief is not the worker's mistake, so it counts as passed.
 * - ชิ้นงานเผยแพร่: content finished with its publish day in this month, split organic/paid.
 * - Reach @7 วัน: the D+7 snapshot, averaged per post.
 */
export interface ReviewItem {
  id: string;
  kind: 'task' | 'content';
  title: string;
  memberId: string;
  memberIds: string[];
  status: string;
  due: Date | null;
  submittedAt: Date | null;
  waitingOn: string | null;
  firstReview: string | null;
  reviseReason: string | null;
  promotion?: string | null;
  reach7?: number | null;
  engagement7?: number | null;
}

export interface Ratio { done: number; total: number }

export interface MemberKpi { id: string; name: string; target: number; current: number; unit: string; company: string }

export interface MemberSummary {
  memberId: string;
  name: string;
  avatar: string | null;
  company: string;
  onTime: Ratio;
  waiting: number;
  firstPass: Ratio;
  published: { organic: number; paid: number; unknown: number };
  reach7: { organic: number | null; paid: number | null; posts: number };
  kpis: MemberKpi[];
  evaluation: Evaluation | null;
}

export interface Evaluation { summary: string; strengths: string | null; improvements: string | null; nextSteps: string | null; source: string; updatedAt: string }

export interface KpiHubSummary {
  month: number;
  year: number;
  /** Last day counted for "due" work: today for the current month, the month end otherwise. */
  countedThrough: string;
  team: { onTime: Ratio; firstPass: Ratio; waiting: number; published: { organic: number; paid: number; unknown: number } };
  members: MemberSummary[];
}

const pad = (n: number) => String(n).padStart(2, '0');

export function monthBounds(year: number, month: number) {
  const first = `${year}-${pad(month)}-01`;
  const last = `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
  return { first, last };
}

/** UTC range that covers every Bangkok day of the month (Bangkok is UTC+7). */
export function monthQueryRange(year: number, month: number) {
  return { gte: new Date(Date.UTC(year, month - 1, 1, -7)), lt: new Date(Date.UTC(year, month, 1, -7)) };
}

export const percent = (ratio: Ratio): number | null => (ratio.total ? Math.round((ratio.done / ratio.total) * 100) : null);

const assignees = (item: { memberId: string; memberIds: string[] }) => (item.memberIds.length ? item.memberIds : [item.memberId]);

export function summarizeMonth(input: {
  year: number;
  month: number;
  today: string;
  members: { id: string; name: string; avatar: string | null; company: string }[];
  items: ReviewItem[];
  kpis: (MemberKpi & { memberId: string })[];
  evaluations: (Evaluation & { memberId: string })[];
}): KpiHubSummary {
  const { first, last } = monthBounds(input.year, input.month);
  const countedThrough = input.today < last ? input.today : last;
  const inMonth = (item: ReviewItem) => {
    const day = item.due ? bangkokDateKey(item.due) : '';
    return day >= first && day <= last ? day : null;
  };

  const members: MemberSummary[] = input.members.map(member => {
    const mine = input.items.filter(item => assignees(item).includes(member.id));
    const onTime: Ratio = { done: 0, total: 0 };
    const firstPass: Ratio = { done: 0, total: 0 };
    const published = { organic: 0, paid: 0, unknown: 0 };
    const reach: Record<'organic' | 'paid', number[]> = { organic: [], paid: [] };
    let waiting = 0;

    for (const item of mine) {
      const day = inMonth(item);
      if (!day) continue;
      if (day <= countedThrough) {
        if (item.waitingOn) waiting++;
        else {
          onTime.total++;
          if (item.submittedAt && bangkokDateKey(item.submittedAt) <= day) onTime.done++;
        }
      }
      if (item.firstReview === 'pass' || item.firstReview === 'revise') {
        firstPass.total++;
        if (item.firstReview === 'pass' || item.reviseReason === 'brief') firstPass.done++;
      }
      if (item.kind === 'content' && item.status === 'done') {
        const side = item.promotion === 'organic' || item.promotion === 'paid' ? item.promotion : null;
        published[side ?? 'unknown']++;
        if (side && typeof item.reach7 === 'number') reach[side].push(item.reach7);
      }
    }

    const average = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);
    const evaluation = input.evaluations.find(e => e.memberId === member.id) ?? null;
    return {
      memberId: member.id,
      name: member.name,
      avatar: member.avatar,
      company: member.company,
      onTime,
      waiting,
      firstPass,
      published,
      reach7: { organic: average(reach.organic), paid: average(reach.paid), posts: reach.organic.length + reach.paid.length },
      kpis: input.kpis.filter(k => k.memberId === member.id).map(({ memberId: _, ...kpi }) => kpi),
      evaluation: evaluation && { summary: evaluation.summary, strengths: evaluation.strengths, improvements: evaluation.improvements, nextSteps: evaluation.nextSteps, source: evaluation.source, updatedAt: evaluation.updatedAt },
    };
  });

  // Shared work appears under each assignee but is one piece of work for the team totals.
  const team = {
    onTime: { done: 0, total: 0 },
    firstPass: { done: 0, total: 0 },
    waiting: 0,
    published: { organic: 0, paid: 0, unknown: 0 },
  };
  for (const item of input.items) {
    const day = inMonth(item);
    if (!day) continue;
    if (day <= countedThrough) {
      if (item.waitingOn) team.waiting++;
      else {
        team.onTime.total++;
        if (item.submittedAt && bangkokDateKey(item.submittedAt) <= day) team.onTime.done++;
      }
    }
    if (item.firstReview === 'pass' || item.firstReview === 'revise') {
      team.firstPass.total++;
      if (item.firstReview === 'pass' || item.reviseReason === 'brief') team.firstPass.done++;
    }
    if (item.kind === 'content' && item.status === 'done') {
      const side = item.promotion === 'organic' || item.promotion === 'paid' ? item.promotion : 'unknown';
      team.published[side]++;
    }
  }

  return { month: input.month, year: input.year, countedThrough, team, members };
}
