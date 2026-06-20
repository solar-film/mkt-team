const { PrismaClient } = require('@prisma/client');

const regions = [
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'ap-south-1', 'us-east-1', 'us-west-1', 'us-west-2',
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1',
  'sa-east-1', 'ca-central-1'
];

async function checkRegion(region) {
  const url = `postgresql://postgres.xoyhctcdgxxeowchoqfr:GFS789gfs%2B%23@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.teamMember.findMany();
    console.log(`✅ SUCCESS: ${region}`);
    return url;
  } catch (e) {
    if (e.message.includes('tenant/user')) {
      // console.log(`❌ FAILED (tenant not found): ${region}`);
    } else {
      console.log(`⚠️ OTHER ERROR for ${region}: ${e.message.split('\n')[0]}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const promises = regions.map(r => checkRegion(r));
  const results = await Promise.all(promises);
  const successUrl = results.find(r => r);
  if (successUrl) {
    console.log('\nUSE THIS URL:');
    console.log(successUrl);
  } else {
    console.log('\nCould not find working region.');
  }
}

main();
