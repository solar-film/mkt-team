const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.xoyhctcdgxxeowchoqfr:GFS789gfs%2B%23@pooler.supabase.com:6543/postgres'
    }
  }
});
prisma.teamMember.findMany().then(r => console.log('OK pooler.supabase.com', r.length)).catch(console.error).finally(() => prisma.$disconnect());
