import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rawUrl = process.env.DATABASE_URL || '';
    const isUrlConfigured = rawUrl.length > 0;
    
    // Mask the password for security
    let maskedUrl = rawUrl;
    if (rawUrl.includes('@')) {
      const parts = rawUrl.split('@');
      const protocolAndUser = parts[0].split(':');
      if (protocolAndUser.length >= 3) {
        maskedUrl = `${protocolAndUser[0]}:${protocolAndUser[1]}:***@${parts[1]}`;
      }
    }

    const start = Date.now();
    const count = await prisma.teamMember.count();
    const duration = Date.now() - start;

    return NextResponse.json({
      success: true,
      message: 'Database connected successfully',
      memberCount: count,
      pingMs: duration,
      databaseUrlMasked: maskedUrl,
      directUrlConfigured: !!process.env.DIRECT_URL
    });
  } catch (error: any) {
    console.error('Test DB Error:', error);
    
    const rawUrl = process.env.DATABASE_URL || '';
    let maskedUrl = rawUrl;
    if (rawUrl.includes('@')) {
      const parts = rawUrl.split('@');
      const protocolAndUser = parts[0].split(':');
      if (protocolAndUser.length >= 3) {
        maskedUrl = `${protocolAndUser[0]}:${protocolAndUser[1]}:***@${parts[1]}`;
      }
    }

    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      errorMessage: error.message,
      errorCode: error.code,
      errorName: error.name,
      databaseUrlMasked: maskedUrl,
      directUrlConfigured: !!process.env.DIRECT_URL
    }, { status: 500 });
  }
}
