import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { browserWriteRejection } from '@/lib/browser-request';
import { MEMBER_COOKIE, MEMBER_HEADER, PUBLIC_PAGES, publicApi, readCookie, sessionMemberId } from '@/lib/member-auth';
import { prisma } from '@/lib/prisma';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ยกเว้น (Bypass) API บางตัวที่ต้องให้เซิร์ฟเวอร์ต่างประเทศเรียกเข้ามาได้
  // เช่น LINE Webhook (มักมาจากญี่ปุ่น) และ Vercel Cron Jobs (มักมาจากอเมริกา)
  // /api/kpi-hub/evaluations รับผลประเมินจากมะลิ ตรวจ token ในตัว route เอง
  if (
    pathname === '/api/line-webhook' ||
    pathname.startsWith('/api/cron/') ||
    pathname === '/api/kpi-hub/evaluations'
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

  // A browser must never be able to claim an identity through this header.
  const headers = new Headers(request.headers);
  headers.delete(MEMBER_HEADER);
  const token = readCookie(request, MEMBER_COOKIE);

  if (pathname.startsWith('/api/') && !publicApi(pathname, request.method)) {
    let memberId: string | null = null;
    try {
      memberId = await sessionMemberId(prisma, token);
    } catch (error) {
      console.error('Session check failed:', error instanceof Error ? error.message : 'unknown error');
      return NextResponse.json({ error: 'Session check failed' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (!memberId) return NextResponse.json({ error: 'Login required' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
    headers.set(MEMBER_HEADER, memberId);
  } else if (!pathname.startsWith('/api/') && !PUBLIC_PAGES.has(pathname) && !token) {
    // Pages only check that a cookie exists; every data request above is verified against the database.
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const response = NextResponse.next({ request: { headers } });
  if (pathname.startsWith('/api/') && !/^\/api\/(ideas\/[^/]+\/attachments|members\/[^/]+\/avatar)$/.test(pathname)) {
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
