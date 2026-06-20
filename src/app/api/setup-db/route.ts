import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Attempt to create the table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "IdeaNote" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "memberId" TEXT,
        "recommendedFor" TEXT,
        "company" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "IdeaNote_pkey" PRIMARY KEY ("id")
      );
    `);

    // In case the table already exists from step 1, but missing the new columns from step 2
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "IdeaNote" ADD COLUMN "recommendedFor" TEXT;`);
    } catch (e) {
      console.log('Column recommendedFor might already exist', e);
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "IdeaNote" ADD COLUMN "company" TEXT;`);
    } catch (e) {
      console.log('Column company might already exist', e);
    }

    return NextResponse.json({ success: true, message: "Database schema setup successfully." });
  } catch (error: any) {
    console.error('Setup DB Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
