import { invalidateWorkspace } from '@/lib/workspace-cache'
import { readJsonBody, RequestBodyError } from '@/lib/request-body'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validAttachment, decodeAttachment, attachmentMetadata } from '@/lib/attachments'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const ideaNoteId = params.id
    const body = await readJsonBody(request)
    const { name, type, url } = body

    if (!validAttachment(name, type, url)) {
      return NextResponse.json({ error: 'Invalid file or file exceeds 3MB' }, { status: 400 })
    }

    const attachment = await prisma.ideaAttachment.create({
      data: {
        name,
        type: type || 'application/octet-stream',
        url,
        ideaNoteId
      }
    })

    invalidateWorkspace();
    return NextResponse.json(attachmentMetadata(attachment, ideaNoteId))
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 })
  }
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const attachmentId = new URL(request.url).searchParams.get('attachmentId');
  if (!attachmentId) return NextResponse.json({ error: 'Attachment ID is required' }, { status: 400 });
  try {
    const file = await prisma.ideaAttachment.findFirst({ where: { id: attachmentId, ideaNoteId: id } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    const decoded = decodeAttachment(file.url);
    if (!decoded) return NextResponse.json({ error: 'Unsupported file format' }, { status: 400 });
    const inline = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(decoded.type);
    return new Response(new Uint8Array(decoded.bytes), { headers: {
      'Content-Type': inline ? decoded.type : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, max-age=3600',
    } });
  } catch {
    return NextResponse.json({ error: 'Failed to load attachment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachmentId')

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID is required' }, { status: 400 })
    }

    await prisma.ideaAttachment.delete({
      where: { id: attachmentId, ideaNoteId: params.id }
    })

    invalidateWorkspace();
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 })
  }
}
