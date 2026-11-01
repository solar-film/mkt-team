import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import { invalidateWorkspace } from '@/lib/workspace-cache';
import { parseWorkReview, WorkReviewError } from '@/lib/work-review';

export const dynamic = 'force-dynamic';

const REVIEW_FIELDS = { id: true, submittedAt: true, waitingOn: true, firstReview: true, reviseReason: true } as const;

/** Saves the KPI review of one task or content: { kind, id, submittedAt?, waitingOn?, firstReview?, reviseReason?, promotion? }. */
export async function PUT(request: Request) {
  try {
    const body = await readJsonBody(request);
    const kind = body.kind === 'task' || body.kind === 'content' ? body.kind : null;
    const id = typeof body.id === 'string' && body.id.length <= 64 ? body.id : '';
    if (!kind || !id) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const data = parseWorkReview(body, kind);
    const saved = kind === 'task'
      ? await prisma.task.update({ where: { id }, data, select: REVIEW_FIELDS })
      : await prisma.content.update({ where: { id }, data, select: { ...REVIEW_FIELDS, promotion: true } });
    invalidateWorkspace();
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof WorkReviewError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if ((error as { code?: string })?.code === 'P2025') return NextResponse.json({ error: 'ไม่พบงานนี้' }, { status: 404 });
    console.error('Work review save failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 });
  }
}
