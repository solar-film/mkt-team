import { initDoc } from './src/lib/google-sheets';
require('dotenv').config();

async function main() {
  const doc = await initDoc();
  const sheet = doc.sheetsByTitle['Content'];
  const rows = await sheet.getRows();
  console.log('Rows in Google Sheets (Content):', rows.length);
  const withMeeting = rows.filter(r => r.get('meetingId'));
  console.log('With meetingId in Google Sheets:', withMeeting.length);
}
main().catch(console.error);
