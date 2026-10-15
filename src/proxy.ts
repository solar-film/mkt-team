import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { browserWriteRejection } from '@/lib/browser-request';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ยกเว้น (Bypass) API บางตัวที่ต้องให้เซิร์ฟเวอร์ต่างประเทศเรียกเข้ามาได้
  // เช่น LINE Webhook (มักมาจากญี่ปุ่น) และ Vercel Cron Jobs (มักมาจากอเมริกา)
  if (
    pathname === '/api/line-webhook' ||
    pathname.startsWith('/api/cron/')
  ) {
    return NextResponse.next();
  }

  // ดึงค่าประเทศจาก Header ที่ Vercel ส่งมาให้
  const country = (request as any).geo?.country || request.headers.get('x-vercel-ip-country');

  // ถ้ามีค่าประเทศ (ไม่ได้รันแบบ Local) และไม่ใช่ประเทศไทย (TH) ให้บล็อกทันที
  if (country && country !== 'TH') {
    return new NextResponse(`Access denied. This service is restricted to Thailand only. (Your location: ${country})`, { 
      status: 403,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  if (pathname.startsWith('/api/')) {
    const rejected = browserWriteRejection(request);
    if (rejected) return NextResponse.json({ error: 'Request rejected' }, { status: rejected });
  }
  const response = NextResponse.next();
  if (pathname.startsWith('/api/') && !/^\/api\/ideas\/[^/]+\/attachments$/.test(pathname)) {
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * บังคับใช้ Middleware กับทุกหน้า ยกเว้น:
     * - _next/static (ไฟล์ Static ของ Next.js)
     * - _next/image (ไฟล์รูปภาพที่ผ่านการ Optimize)
     * - ไฟล์รูปภาพต่างๆ (svg, png, jpg, ฯลฯ)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
