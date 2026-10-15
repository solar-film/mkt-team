import { invalidateWorkspace } from '@/lib/workspace-cache'
import { readJsonBody, RequestBodyError } from '@/lib/request-body'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const ideaNoteId = params.id
    const body = await readJsonBody(request)
    const { text, memberId } = body

    if (!text || !memberId) {
      return NextResponse.json({ error: 'Text and memberId are required' }, { status: 400 })
    }

    const comment = await prisma.ideaComment.create({
      data: {
        text,
        memberId,
        ideaNoteId
      }
    })

    invalidateWorkspace();
    return NextResponse.json(comment)
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 })
    }

    await prisma.ideaComment.delete({
      where: { id: commentId, ideaNoteId: params.id }
    })

    invalidateWorkspace();
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}
