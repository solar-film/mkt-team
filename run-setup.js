const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "IdeaNote" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "memberId" TEXT,
        "recommendedFor" TEXT,
        "company" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "priority" TEXT NOT NULL DEFAULT 'normal',
        "deadline" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "IdeaNote_pkey" PRIMARY KEY ("id")
    )
  `);
  console.log('IdeaNote table created successfully!');
}
main().catch(console.error).finally(()=>prisma.$disconnect());
