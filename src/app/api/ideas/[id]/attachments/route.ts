import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const ideaNoteId = params.id
    const body = await request.json()
    const { name, type, url } = body

    if (!name || !type || !url) {
      return NextResponse.json({ error: 'Name, type, and url are required' }, { status: 400 })
    }

    const attachment = await prisma.ideaAttachment.create({
      data: {
        name,
        type,
        url,
        ideaNoteId
      }
    })

    return NextResponse.json(attachment)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 })
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
      where: { id: attachmentId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 })
  }
}
