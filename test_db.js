const { PrismaClient } = require('@prisma/client');
const format = (date) => {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd}`;
};

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany();
  console.log('Events in DB:', events);
  
  const targetDate = new Date();
  const nextDay = new Date(targetDate);
  nextDay.setDate(targetDate.getDate() + 1);
  
  const targetStr = format(targetDate, 'yyyy-MM-dd');
  const nextStr = format(nextDay, 'yyyy-MM-dd');
  console.log('Target:', targetStr, 'Next:', nextStr);
  
  events.forEach(e => {
    const eventDate = new Date(e.date);
    const eventStr = format(eventDate, 'yyyy-MM-dd');
    console.log('Event:', e.title, 'EventStr:', eventStr, 'Matches?', eventStr === targetStr || eventStr === nextStr);
  });
}

main().finally(() => prisma.$disconnect());
