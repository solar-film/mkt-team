import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import { secretMatches } from '@/lib/integration-security';
import { invalidateWorkspace } from '@/lib/workspace-cache';
import { parseEvaluations, EvaluationInputError } from '@/lib/member-evaluation';

import { monthQueryRange } from '@/lib/kpi-summary';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { GET as readKpiHub } from '../route';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** Both methods are for มะลิ only: `Authorization: Bearer <KPI_EVALUATION_TOKEN>`. */
function authError(request: Request): NextResponse | null {
  const token = process.env.KPI_EVALUATION_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: 'Evaluation upload is not configured' }, { status: 503, headers: NO_STORE });
  if (!secretMatches(request.headers.get('authorization'), `Bearer ${token}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  return null;
}

/**
 * What มะลิ reads before the monthly evaluation (scheduled task, no member login):
 * the same numbers as the KPI กลาง page, plus that month's tasks and contents per person.
 * GET ?year=2026&month=11
 */
export async function GET(request: Request) {
  const denied = authError(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const year = Number(params.get('year'));
  const month = Number(params.get('month'));
  if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400, headers: NO_STORE });
  }

  try {
    const hub = await readKpiHub(new Request(new URL(`/api/kpi-hub?year=${year}&month=${month}`, request.url)));
    if (!hub.ok) return NextResponse.json({ error: 'KPI read failed' }, { status: 503, headers: NO_STORE });
    const summary = await hub.json();

    const range = monthQueryRange(year, month);
    const workSelect = { title: true, status: true, company: true, memberId: true, memberIds: true } as const;
    const [members, tasks, contents] = await Promise.all([
      prisma.teamMember.findMany({ where: { id: { not: 'all' } }, select: { id: true, name: true } }),
      prisma.task.findMany({ where: { deadline: range }, select: { ...workSelect, deadline: true } }),
      prisma.content.findMany({ where: { publishDate: range }, select: { ...workSelect, type: true, platform: true, publishDate: true } }),
    ]);
    const names = new Map(members.map(m => [m.id, m.name]));
    const who = (work: { memberId: string; memberIds: string[] }) =>
      [...new Set([work.memberId, ...work.memberIds])].map(id => names.get(id)).filter((name): name is string => Boolean(name));
    const day = (date: Date | null) => (date ? bangkokDateKey(date) : null);

    const work = [
      ...tasks.map(t => ({ kind: 'task', title: t.title, status: t.status, company: t.company, date: day(t.deadline), members: who(t) })),
      ...contents.map(c => ({
        kind: 'content', title: c.title, type: c.type, platform: c.platform, status: c.status, company: c.company,
        date: day(c.publishDate), members: who(c),
      })),
    ].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    return NextResponse.json({ year, month, summary, work }, { headers: NO_STORE });
  } catch (error) {
    console.error('Evaluation data read failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Read failed' }, { status: 503, headers: NO_STORE });
  }
}

/**
 * มะลิ (AI) sends each month's evaluations here. Not a member session: the proxy lets this path
 * through, and the request must carry `Authorization: Bearer <KPI_EVALUATION_TOKEN>`.
 * Body: { year, month, evaluations: [{ memberId | memberName, summary, strengths?, improvements?, nextSteps? }] }
 * Re-sending the same member and month replaces that evaluation.
 */
export async function POST(request: Request) {
  const denied = authError(request);
  if (denied) return denied;

  try {
    const members = await prisma.teamMember.findMany({ where: { id: { not: 'all' } }, select: { id: true, name: true } });
    const { year, month, evaluations } = parseEvaluations(await readJsonBody(request), members);
    await prisma.$transaction(evaluations.map(({ memberId, ...fields }) => prisma.memberEvaluation.upsert({
      where: { memberId_year_month: { memberId, year, month } },
      create: { memberId, year, month, ...fields },
      update: fields,
    })));
    // The KPI กลาง page is cached until the next save; this upload is one.
    invalidateWorkspace();
    return NextResponse.json({ saved: evaluations.length, year, month });
  } catch (error) {
    if (error instanceof EvaluationInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Evaluation upload failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
