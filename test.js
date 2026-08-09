const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const task = await prisma.task.create({
      data: {
        title: 'Test Task',
        memberId: 'id1,id2',
        company: 'GFS,MHL'
      }
    });
    console.log('Success:', task);
    await prisma.task.delete({ where: { id: task.id } });
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
