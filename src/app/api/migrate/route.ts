import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "IdeaNote" 
      ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'idea',
      ADD COLUMN IF NOT EXISTS "platform" TEXT,
      ADD COLUMN IF NOT EXISTS "kpiId" TEXT;
    `);
    return NextResponse.json({ success: true, message: 'Migration applied successfully.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
