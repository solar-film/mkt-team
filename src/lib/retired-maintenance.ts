import { NextResponse } from 'next/server';

export function retiredMaintenanceEndpoint() {
  return NextResponse.json({ error: 'Not found' }, {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
