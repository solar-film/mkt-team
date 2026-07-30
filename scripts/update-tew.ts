import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const members = await prisma.teamMember.findMany();
  console.log('Current members:', members.map(m => m.name));
  
  const res1 = await prisma.teamMember.updateMany({
    where: { name: 'TEW' },
    data: { name: 'TAW' }
  });
  console.log('Updated TEW:', res1.count);

  const res2 = await prisma.teamMember.updateMany({
    where: { name: 'Tew' },
    data: { name: 'Taw' }
  });
  console.log('Updated Tew:', res2.count);

  console.log('Done');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
