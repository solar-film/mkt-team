const { PrismaClient } = require('@prisma/client');

async function test(host) {
  const url = `postgres://postgres.xoyhctcdgxxeowchoqfr:GFS789gfs%2B%23@${host}:6543/postgres?sslmode=require&pgbouncer=true`;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const res = await prisma.teamMember.findMany();
    console.log(`✅ SUCCESS on ${host}`);
    return url;
  } catch(e) {
    console.log(`❌ FAILED on ${host}: ${e.message.split('\n')[0]}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await test('aws-0-ap-southeast-1.pooler.supabase.com');
  await test('aws-1-ap-southeast-1.pooler.supabase.com');
  await test('aws-0-ap-southeast-2.pooler.supabase.com');
  await test('aws-1-ap-southeast-2.pooler.supabase.com');
  await test('aws-0-us-east-1.pooler.supabase.com');
  await test('aws-1-us-east-1.pooler.supabase.com');
}
main();
