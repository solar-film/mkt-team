const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.xoyhctcdgxxeowchoqfr:GFS789gfs%2B%23@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
    }
  }
});
prisma.teamMember.findMany()
  .then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
