const https = require('https');

const url = 'https://marketing-team-tracker.vercel.app/api/meetings';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const meetings = JSON.parse(data);
      // Show first 3 meetings with just title and attendees
      const summary = meetings.slice(0, 5).map(m => ({
        title: m.title,
        attendees: m.attendees,
        hasAttendees: !!m.attendees,
        attendeesType: typeof m.attendees
      }));
      console.log(JSON.stringify(summary, null, 2));
      console.log('\nTotal meetings:', meetings.length);
      
      // Count how many have non-empty attendees
      const withAttendees = meetings.filter(m => m.attendees && m.attendees.trim());
      console.log('Meetings with attendees:', withAttendees.length);
      if (withAttendees.length > 0) {
        console.log('\nFirst meeting with attendees:');
        console.log('  Title:', withAttendees[0].title);
        console.log('  Attendees raw:', JSON.stringify(withAttendees[0].attendees));
      }
    } catch (e) {
      console.error('Parse error:', e.message);
      console.log('Raw response (first 500 chars):', data.substring(0, 500));
    }
  });
}).on('error', (e) => {
  console.error('Request error:', e.message);
});
