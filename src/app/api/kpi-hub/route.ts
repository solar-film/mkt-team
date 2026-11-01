import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { cachedJsonRead } from '@/lib/workspace-cache';
import { EVALUATION_EXCLUDED_ROLE, HIDDEN_KPI_NAMES, kpiCurrent, monthQueryRange, summarizeMonth, type LinkedWork, type ReviewItem } from '@/lib/kpi-summary';
import { avatarUrl, MEMBER_LIST_SELECT } from '@/lib/member-avatar';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };
const REVIEW_SELECT = {
  id: true, title: true, memberId: true, memberIds: true, status: true,
  submittedAt: true, waitingOn: true, firstReview: true, reviseReason: true,
} as const;

/**
 * KPI กลาง for one month (?year=2026&month=11). Members only: the proxy checks the session.
 * Cached like the dashboard: every save in the app (tasks, contents, KPIs, work review,
 * evaluations) expires it, and ?fresh=1 right after a save reads straight from the database.
 * Today's date is in the key because "due so far" moves with it.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const today = bangkokDateKey(new Date());
  const year = Number(params.get('year') || today.slice(0, 4));
  const month = Number(params.get('month') || today.slice(5, 7));
  if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'เดือนไม่ถูกต้อง' }, { status: 400, headers });
  }
  return cachedJsonRead(['kpi-hub', String(year), String(month), today], () => readMonth(year, month, today), params.get('fresh') === '1');
}

async function readMonth(year: number, month: number, today: string): Promise<Response> {
  try {
    const range = monthQueryRange(year, month);
    const linkedSelect = { kpiId: true, status: true, memberId: true, memberIds: true } as const;
    // One round of queries at once; avatars are looked up alongside instead of after the members.
    const [members, withPhoto, tasks, contents, kpis, evaluations, linkedTasks, linkedContents] = await Promise.all([
      // The Admin manages the team and is not evaluated on this page (user decision 1 Nov 69).
      prisma.teamMember.findMany({ where: { id: { not: 'all' }, status: { not: 'inactive' }, role: { not: EVALUATION_EXCLUDED_ROLE } }, select: MEMBER_LIST_SELECT, orderBy: { name: 'asc' } }),
      prisma.teamMember.findMany({ where: { AND: [{ avatar: { not: null } }, { avatar: { not: '' } }] }, select: { id: true } }),
      prisma.task.findMany({ where: { deadline: range }, select: { ...REVIEW_SELECT, deadline: true } }),
      prisma.content.findMany({
        where: { publishDate: range },
        select: {
          ...REVIEW_SELECT, publishDate: true, promotion: true,
          metrics: { where: { snapshot: 'D+7' }, select: { reach: true, likes: true, comments: true, shares: true }, take: 1 },
        },
      }),
      prisma.kPI.findMany({ where: { year, month }, orderBy: { name: 'asc' } }),
      prisma.memberEvaluation.findMany({ where: { year, month } }),
      prisma.task.findMany({ where: { kpiId: { not: null } }, select: linkedSelect }),
      prisma.content.findMany({ where: { kpiId: { not: null } }, select: linkedSelect }),
    ]);
    const linked: LinkedWork[] = [
      ...linkedTasks.map(work => ({ ...work, kind: 'task' as const })),
      ...linkedContents.map(work => ({ ...work, kind: 'content' as const })),
    ];

    const items: ReviewItem[] = [
      ...tasks.map(({ deadline, ...task }) => ({ ...task, kind: 'task' as const, due: deadline })),
      ...contents.map(({ publishDate, metrics, ...content }) => {
        const metric = metrics[0];
        return {
          ...content, kind: 'content' as const, due: publishDate,
          reach7: metric?.reach ?? null,
          engagement7: metric ? (metric.likes ?? 0) + (metric.comments ?? 0) + (metric.shares ?? 0) : null,
        };
      }),
    ];

    const photo = new Set(withPhoto.map(member => member.id));
    const summary = summarizeMonth({
      year, month, today,
      members: members.map(m => ({ id: m.id, name: m.name, avatar: photo.has(m.id) ? avatarUrl(m) : null, company: m.company })),
      items,
      kpis: kpis.filter(k => !HIDDEN_KPI_NAMES.has(k.name))
        .map(k => ({ id: k.id, memberId: k.memberId, name: k.name, target: k.target, current: kpiCurrent(k, linked), unit: k.unit, company: k.company })),
      evaluations: evaluations.map(e => ({ ...e, updatedAt: e.updatedAt.toISOString() })),
    });
    return NextResponse.json(summary, { headers });
  } catch (error) {
    console.error('KPI hub read failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'โหลดข้อมูลไม่สำเร็จ' }, { status: 503, headers });
  }
}
