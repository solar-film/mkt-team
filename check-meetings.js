const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tasks = await prisma.task.findMany({ where: { meetingId: { not: null, not: '' } } });
  const contents = await prisma.content.findMany({ where: { meetingId: { not: null, not: '' } } });
  console.log('Tasks with meetingId:', tasks.length);
  console.log('Contents with meetingId:', contents.length);
  if (tasks.length > 0) console.log('Sample Tasks:', tasks.slice(0, 2).map(t => ({ id: t.id, meetingId: t.meetingId })));
  if (contents.length > 0) console.log('Sample Contents:', contents.slice(0, 2).map(c => ({ id: c.id, meetingId: c.meetingId })));
}
main().finally(() => prisma.$disconnect());
