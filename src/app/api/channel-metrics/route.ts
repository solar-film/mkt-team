import { cachedJsonRead, invalidateWorkspace } from '@/lib/workspace-cache'
import { readJsonBody, RequestBodyError } from '@/lib/request-body'
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


async function readGET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    
    if (!validPeriod(month, year)) return NextResponse.json({ error: 'Invalid month/year' }, { status: 400 });

    const metrics = await prisma.channelMetric.findMany({
      where: {
        month: Number(month),
        year: Number(year)
      }
    });
    return NextResponse.json({ metrics });
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const { channelId, month, year, followers, reach, messages, adSpend, recordedById, recordedDate } = body;
    if (typeof channelId !== 'string' || !channelId || !validPeriod(month, year) ||
        (recordedById != null && typeof recordedById !== 'string') ||
        (recordedDate && (typeof recordedDate !== 'string' || !Number.isFinite(new Date(recordedDate).getTime())))) {
      return NextResponse.json({ error: 'Invalid channel metric data' }, { status: 400 });
    }
    const values = { followers: optionalNumber(followers), reach: optionalNumber(reach),
      messages: optionalNumber(messages), adSpend: optionalNumber(adSpend, false) };
    
    const result = await prisma.channelMetric.upsert({
      where: {
        channelId_month_year: {
          channelId, month: parseInt(month), year: parseInt(year)
        }
      },
      update: {
        ...values,
        recordedById: recordedById || null,
        recordedDate: recordedDate ? new Date(recordedDate) : null,
      },
      create: {
        channelId,
        month: parseInt(month),
        year: parseInt(year),
        ...values,
        recordedById: recordedById || null,
        recordedDate: recordedDate ? new Date(recordedDate) : null,
      }
    });

    invalidateWorkspace();
    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error(error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}

function validPeriod(month: unknown, year: unknown) {
  return /^\d{1,2}$/.test(String(month)) && +String(month) >= 1 && +String(month) <= 12 &&
    /^\d{4}$/.test(String(year)) && +String(year) >= 2000 && +String(year) <= 2200;
}

function optionalNumber(value: unknown, integer = true): number | null | undefined {
  if (value === undefined) return undefined; // Hidden fields must keep their stored statistics.
  if (value === null || value === '') return null;
  if (!['number', 'string'].includes(typeof value)) throw new RequestBodyError('Invalid metric value');
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 ||
      (integer && (!Number.isInteger(number) || number > 2_147_483_647))) throw new RequestBodyError('Invalid metric value');
  return number;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = ["channel-metrics", ...["month","year"].map(name => url.searchParams.get(name) || '')];
  const snapshot = new Request(url);
  return cachedJsonRead(key, () => readGET(snapshot), url.searchParams.get('fresh') === '1');
}
