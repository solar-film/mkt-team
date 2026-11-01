import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import { secretMatches } from '@/lib/integration-security';
import { invalidateWorkspace } from '@/lib/workspace-cache';
import { AI_QUEUE_DAYS, AI_REVIEW_CRITERIA, AiReviewInputError, parseAiReviews } from '@/lib/ai-review';

export const dynamic = 'force-dynamic';

/**
 * มะลิ (AI) checks work quality here. Not a member session: the proxy lets this path through and
 * the request must carry `Authorization: Bearer <KPI_EVALUATION_TOKEN>` (same token as evaluations).
 *
 * GET  → finished work of the last AI_QUEUE_DAYS days that the Admin has not reviewed yet,
 *        with the brief (description), link and brand, plus the criteria to check against.
 * POST → { reviews: [{ kind: 'task' | 'content', id, suggestion: 'pass' | 'revise', note }] }
 *        stores the suggestion; it never touches firstReview, which only the Admin sets.
 */
function authorize(request: Request): NextResponse | null {
  const token = process.env.KPI_EVALUATION_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: 'AI review is not configured' }, { status: 503 });
  if (!secretMatches(request.headers.get('authorization'), `Bearer ${token}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

const QUEUE_FIELDS = {
  id: true, title: true, description: true, company: true, status: true, link: true,
  submittedAt: true, aiReview: true, aiReviewNote: true, aiReviewedAt: true,
  member: { select: { name: true } },
} as const;

export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  try {
    const since = new Date(Date.now() - AI_QUEUE_DAYS * 24 * 3600 * 1000);
    const pending = { firstReview: null, updatedAt: { gte: since } };
    const [tasks, contents] = await Promise.all([
      prisma.task.findMany({ where: { ...pending, status: { in: ['done', 'เสร็จแล้ว'] } }, select: { ...QUEUE_FIELDS, deadline: true }, orderBy: { updatedAt: 'desc' } }),
      prisma.content.findMany({
        where: { ...pending, status: { in: ['done', 'published', 'เสร็จแล้ว'] } },
        select: { ...QUEUE_FIELDS, type: true, platform: true, publishDate: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return NextResponse.json({
      criteria: AI_REVIEW_CRITERIA,
      items: [
        ...tasks.map(({ member, ...task }) => ({ kind: 'task' as const, memberName: member?.name ?? null, ...task })),
        ...contents.map(({ member, ...content }) => ({ kind: 'content' as const, memberName: member?.name ?? null, ...content })),
      ],
    });
  } catch (error) {
    console.error('AI review queue failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Load failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  try {
    const reviews = parseAiReviews(await readJsonBody(request));
    const now = new Date();
    const results = await prisma.$transaction(reviews.map(({ kind, id, suggestion, note }) => {
      const data = { aiReview: suggestion, aiReviewNote: note, aiReviewedAt: now };
      return kind === 'task'
        ? prisma.task.updateMany({ where: { id }, data })
        : prisma.content.updateMany({ where: { id }, data });
    }));
    const notFound = reviews.filter((_, index) => results[index].count === 0).map(({ kind, id }) => `${kind}:${id}`);
    invalidateWorkspace();
    return NextResponse.json({ saved: reviews.length - notFound.length, notFound });
  } catch (error) {
    if (error instanceof AiReviewInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('AI review upload failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
