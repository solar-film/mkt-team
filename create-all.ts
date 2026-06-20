import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.teamMember.upsert({
    where: { id: 'all' },
    update: {},
    create: {
      id: 'all',
      name: 'ทุกคน / ทั่วไป',
      role: 'General',
      status: 'active'
    }
  });
  console.log('Created member "all"');
}
main().catch(console.error);
