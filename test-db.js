const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.xoyhctcdgxxeowchoqfr:GFS789gfs%2B%23@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
    }
  }
});
prisma.teamMember.findMany().then(r => console.log('OK ap-southeast-1', r.length)).catch(console.error).finally(() => prisma.$disconnect());
