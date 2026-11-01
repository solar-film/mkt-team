import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import { secretMatches } from '@/lib/integration-security';
import { invalidateWorkspace } from '@/lib/workspace-cache';
import { parseEvaluations, EvaluationInputError } from '@/lib/member-evaluation';

export const dynamic = 'force-dynamic';

/**
 * มะลิ (AI) sends each month's evaluations here. Not a member session: the proxy lets this path
 * through, and the request must carry `Authorization: Bearer <KPI_EVALUATION_TOKEN>`.
 * Body: { year, month, evaluations: [{ memberId | memberName, summary, strengths?, improvements?, nextSteps? }] }
 * Re-sending the same member and month replaces that evaluation.
 */
export async function POST(request: Request) {
  const token = process.env.KPI_EVALUATION_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: 'Evaluation upload is not configured' }, { status: 503 });
  if (!secretMatches(request.headers.get('authorization'), `Bearer ${token}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
