import { NextResponse } from 'next/server';
import { validatePhoneUpload } from '@/lib/contact-data';
import { savePhoneUpload } from '@/lib/contact-sync';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

/**
 * Call-log upload. The browser reads the file and sends per-day caller counts only,
 * so phone numbers of customers never reach the server.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { fileName?: unknown } | null;
  const upload = validatePhoneUpload(body);
  if (typeof upload === 'string') return NextResponse.json({ error: upload }, { status: 400, headers });
  try {
    const rows = await savePhoneUpload(upload, typeof body?.fileName === 'string' ? body.fileName : '');
    return NextResponse.json({ ok: true, rows }, { headers });
  } catch (error) {
    console.error('Phone upload failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'บันทึกข้อมูลโทรไม่สำเร็จ' }, { status: 500, headers });
  }
}
