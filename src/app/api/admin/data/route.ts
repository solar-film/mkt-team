import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin-session';
import * as events from '@/app/api/events/route';
import * as tasks from '@/app/api/tasks/route';
import * as kpis from '@/app/api/kpis/route';
import * as contents from '@/app/api/content/route';
import * as ideas from '@/app/api/ideas/route';
import * as meetings from '@/app/api/meetings/route';
import * as members from '@/app/api/members/route';

const tables = { events, tasks, kpis, contents, ideas, meetings, members };

async function dispatch(request: NextRequest, method: 'GET' | 'DELETE') {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const table = new URL(request.url).searchParams.get('table');
  if (!table || !Object.hasOwn(tables, table)) return NextResponse.json({ error: 'Unknown table' }, { status: 400 });
  return tables[table as keyof typeof tables][method](request);
}

export async function GET(request: NextRequest) { return dispatch(request, 'GET'); }
export async function DELETE(request: NextRequest) { return dispatch(request, 'DELETE'); }
