const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const contents = await prisma.content.findMany();
  console.log('Total contents:', contents.length);
  const withMeeting = contents.filter(c => c.meetingId && c.meetingId !== '');
  console.log('Contents with non-empty meetingId:', withMeeting.length);
}
main().finally(() => prisma.$disconnect());
