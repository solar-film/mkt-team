import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    
    if (!month || !year) return NextResponse.json({ error: 'Missing month/year' }, { status: 400 });

    const metrics = await prisma.channelMetric.findMany({
      where: {
        month: parseInt(month),
        year: parseInt(year)
      }
    });
    return NextResponse.json({ metrics });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { channelId, month, year, followers, reach, messages, adSpend, recordedById, recordedDate } = body;
    
    const result = await prisma.channelMetric.upsert({
      where: {
        channelId_month_year: {
          channelId, month: parseInt(month), year: parseInt(year)
        }
      },
      update: {
        followers: followers !== '' && followers !== null ? parseInt(followers) : null,
        reach: reach !== '' && reach !== null ? parseInt(reach) : null,
        messages: messages !== '' && messages !== null ? parseInt(messages) : null,
        adSpend: adSpend !== '' && adSpend !== null ? parseFloat(adSpend) : null,
        recordedById: recordedById || null,
        recordedDate: recordedDate ? new Date(recordedDate) : null,
      },
      create: {
        channelId,
        month: parseInt(month),
        year: parseInt(year),
        followers: followers !== '' && followers !== null ? parseInt(followers) : null,
        reach: reach !== '' && reach !== null ? parseInt(reach) : null,
        messages: messages !== '' && messages !== null ? parseInt(messages) : null,
        adSpend: adSpend !== '' && adSpend !== null ? parseFloat(adSpend) : null,
        recordedById: recordedById || null,
        recordedDate: recordedDate ? new Date(recordedDate) : null,
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
