import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readJsonBody, RequestBodyError } from '@/lib/request-body';
import { invalidateWorkspace } from '@/lib/workspace-cache';
import { MEMBER_HEADER } from '@/lib/member-auth';
import { D7_SNAPSHOT } from '@/lib/facebook-posts';
import { parseReach7, parseWorkReview, WorkReviewError } from '@/lib/work-review';

export const dynamic = 'force-dynamic';

const REACH_FIELDS = { reach: true, source: true } as const;

const reachView = (metric: { reach: number | null; source: string } | null) => ({
  reach7: metric?.reach ?? null,
  reach7Source: metric?.reach == null ? null : metric.source,
});

/** Reach @7 วัน of one content: GET ?id=<contentId>. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!id || id.length > 64) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
  try {
    const metric = await prisma.contentMetric.findUnique({ where: { contentId_snapshot: { contentId: id, snapshot: D7_SNAPSHOT } }, select: REACH_FIELDS });
    return NextResponse.json(reachView(metric));
  } catch (error) {
    console.error('Work review read failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'โหลดไม่สำเร็จ' }, { status: 500 });
  }
}

/**
 * Saves what the รายงานรวม page lets members type for one content: { kind: 'content', id, promotion?, reach7? }.
 * The hand-in time is never taken from the request: the system sets it (see lib/work-review.ts).
 */
export async function PUT(request: Request) {
  try {
    const body = await readJsonBody(request);
    const id = typeof body.id === 'string' && body.id.length <= 64 ? body.id : '';
    if (body.kind !== 'content' || !id) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const data = parseWorkReview(body, 'content');
    const reach7 = parseReach7(body.reach7);
    const recordedById = request.headers.get(MEMBER_HEADER);
    const [saved, metric] = await prisma.$transaction(async tx => {
      const content = await tx.content.update({ where: { id }, data, select: { id: true, promotion: true } });
      const key = { contentId_snapshot: { contentId: id, snapshot: D7_SNAPSHOT } };
      const before = await tx.contentMetric.findUnique({ where: key, select: REACH_FIELDS });
      if (reach7 === undefined || reach7 === (before?.reach ?? null)) return [content, before] as const;
      if (!before && reach7 === null) return [content, null] as const;
      // A typed number replaces an automatic one, so the Windsor note no longer describes it.
      const typed = { reach: reach7, source: 'manual', recordedAt: new Date(), recordedById };
      const after = before
        ? await tx.contentMetric.update({ where: key, data: { ...typed, ...(before.source === 'manual' ? {} : { note: null }) }, select: REACH_FIELDS })
        : await tx.contentMetric.create({ data: { contentId: id, snapshot: D7_SNAPSHOT, ...typed }, select: REACH_FIELDS });
      return [content, after] as const;
    });
    invalidateWorkspace();
    return NextResponse.json({ ...saved, ...reachView(metric) });
  } catch (error) {
    if (error instanceof WorkReviewError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if ((error as { code?: string })?.code === 'P2025') return NextResponse.json({ error: 'ไม่พบงานนี้' }, { status: 404 });
    console.error('Work review save failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 });
  }
}
