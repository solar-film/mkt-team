const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.xoyhctcdgxxeowchoqfr:GFS789gfs%2B%23@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
    }
  }
});
prisma.teamMember.findMany().then(console.log).catch(console.error).finally(() => prisma.$disconnect());
