import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasAdminSession } from '@/lib/admin-session';
import { windsorConfigured } from '@/lib/windsor';
import { invalidateWorkspace } from '@/lib/workspace-cache';
import { D7_SNAPSHOT } from '@/lib/facebook-posts';
import { facebookWindow, syncFacebookPosts } from '@/lib/facebook-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const headers = { 'Cache-Control': 'private, no-store' };

/** Posts of the last 30 days with their matched content and whether D+7 is in. Admin only. */
export async function GET(request: Request) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  const posts = await prisma.facebookPost.findMany({
    where: { createdTime: { gte: new Date(Date.now() - 30 * 86_400_000) } }, orderBy: { createdTime: 'desc' }, take: 300,
  });
  const contentIds = posts.map(p => p.contentId).filter((id): id is string => Boolean(id));
  const [contents, metrics] = await Promise.all([
    prisma.content.findMany({ where: { id: { in: contentIds } }, select: { id: true, title: true } }),
    prisma.contentMetric.findMany({ where: { contentId: { in: contentIds }, snapshot: D7_SNAPSHOT }, select: { contentId: true, reach: true, source: true } }),
  ]);
  return NextResponse.json({
    configured: windsorConfigured(),
    posts: posts.map(p => ({
      id: p.id, createdTime: p.createdTime.toISOString(), firstLine: p.message.split('\n')[0].slice(0, 120), reach: p.reach,
      contentTitle: contents.find(c => c.id === p.contentId)?.title ?? null,
      d7: metrics.find(m => m.contentId === p.contentId) ?? null,
    })),
  }, { headers });
}

/** Runs the nightly pull now. */
export async function POST(request: Request) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (!windsorConfigured()) return NextResponse.json({ error: 'ยังไม่ได้ตั้ง WINDSOR_API_KEY บน Vercel' }, { status: 503, headers });
  const { from, to } = facebookWindow();
  const result = await syncFacebookPosts(from, to, 'admin');
  if (result.d7 > 0) invalidateWorkspace();
  return NextResponse.json({ from, to, ...result }, { status: result.ok ? 200 : 502, headers });
}
