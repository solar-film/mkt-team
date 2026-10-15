import { cachedJsonRead, invalidateWorkspace } from '@/lib/workspace-cache'
import { readJsonBody, RequestBodyError } from '@/lib/request-body'
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


async function readGET() {
  try {
    const channels = await prisma.channel.findMany({
      orderBy: [{ platform: 'asc' }, { name: 'asc' }]
    });
    return NextResponse.json({ channels });
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, platform } = await readJsonBody(request);
    const channel = await prisma.channel.create({
      data: { name, platform }
    });
    invalidateWorkspace();
    return NextResponse.json(channel);
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      await prisma.channel.delete({ where: { id } });
    }
    invalidateWorkspace();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = ["channels"];
  return cachedJsonRead(key, () => readGET(), url.searchParams.get('fresh') === '1');
}
