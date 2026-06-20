import { initDoc } from './src/lib/google-sheets';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const doc = await initDoc();
  const sheet = doc.sheetsByTitle['Task'];
  const rows = await sheet.getRows();
  const dbTasks = await prisma.task.findMany();
  console.log('DB Tasks:', dbTasks.length);
  console.log('Sheet Tasks:', rows.length);
  const missing = rows.filter(r => !dbTasks.find(t => t.id === r.get('id')));
  console.log('Missing Tasks:', missing.map(r => ({ id: r.get('id'), title: r.get('title'), memberId: r.get('memberId'), meetingId: r.get('meetingId') })));
  
  // also let's check what meetings actually exist in the DB!
  const dbMeetings = await prisma.meeting.findMany();
  console.log('\nDB Meetings:', dbMeetings.length);
  console.log(dbMeetings.map(m => ({ id: m.id, title: m.title })));
}
main().finally(() => prisma.$disconnect());
