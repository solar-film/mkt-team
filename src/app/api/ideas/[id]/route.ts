import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cachedJsonRead } from '@/lib/workspace-cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return cachedJsonRead(['idea-detail', id], async () => {
    try {
      const idea = await prisma.ideaNote.findUnique({
        where: { id },
        include: {
          checklists: { orderBy: { createdAt: 'asc' } },
          comments: { orderBy: { createdAt: 'asc' } },
          attachments: {
            select: { id: true, name: true, type: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!idea) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      return NextResponse.json({ ...idea, attachments: idea.attachments.map(file => ({
        ...file, url: `/api/ideas/${id}/attachments?attachmentId=${encodeURIComponent(file.id)}`,
      })) });
    } catch {
      return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
    }
  }, new URL(request.url).searchParams.get('fresh') === '1');
}
