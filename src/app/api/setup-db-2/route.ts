import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS "IdeaChecklist" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "isDone" BOOLEAN NOT NULL DEFAULT false,
          "deadline" TIMESTAMP(3),
          "assigneeId" TEXT,
          "ideaNoteId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "IdeaChecklist_pkey" PRIMARY KEY ("id")
      );

      CREATE TABLE IF NOT EXISTS "IdeaAttachment" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "url" TEXT NOT NULL,
          "ideaNoteId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "IdeaAttachment_pkey" PRIMARY KEY ("id")
      );

      CREATE TABLE IF NOT EXISTS "IdeaComment" (
          "id" TEXT NOT NULL,
          "text" TEXT NOT NULL,
          "memberId" TEXT NOT NULL,
          "ideaNoteId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "IdeaComment_pkey" PRIMARY KEY ("id")
      );

      CREATE INDEX IF NOT EXISTS "IdeaChecklist_ideaNoteId_idx" ON "IdeaChecklist"("ideaNoteId");
      CREATE INDEX IF NOT EXISTS "IdeaAttachment_ideaNoteId_idx" ON "IdeaAttachment"("ideaNoteId");
      CREATE INDEX IF NOT EXISTS "IdeaComment_ideaNoteId_idx" ON "IdeaComment"("ideaNoteId");

      ALTER TABLE "IdeaChecklist" DROP CONSTRAINT IF EXISTS "IdeaChecklist_ideaNoteId_fkey";
      ALTER TABLE "IdeaChecklist" ADD CONSTRAINT "IdeaChecklist_ideaNoteId_fkey" FOREIGN KEY ("ideaNoteId") REFERENCES "IdeaNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "IdeaAttachment" DROP CONSTRAINT IF EXISTS "IdeaAttachment_ideaNoteId_fkey";
      ALTER TABLE "IdeaAttachment" ADD CONSTRAINT "IdeaAttachment_ideaNoteId_fkey" FOREIGN KEY ("ideaNoteId") REFERENCES "IdeaNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "IdeaComment" DROP CONSTRAINT IF EXISTS "IdeaComment_ideaNoteId_fkey";
      ALTER TABLE "IdeaComment" ADD CONSTRAINT "IdeaComment_ideaNoteId_fkey" FOREIGN KEY ("ideaNoteId") REFERENCES "IdeaNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `;

    // Prisma $executeRawUnsafe doesn't support multiple statements in some contexts without wrapping or splitting.
    // We will split by semicolon and execute one by one.
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }

    return NextResponse.json({ message: 'Database schema updated successfully.' });
  } catch (error) {
    console.error('Error setting up DB:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
