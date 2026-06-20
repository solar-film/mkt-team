const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const m = await prisma.meeting.findMany();
  const e = await prisma.event.findMany();
  console.log('--- MEETINGS ---');
  console.log(m.map(x => x.title));
  console.log('--- EVENTS ---');
  console.log(e.map(x => x.title));
}

main();
