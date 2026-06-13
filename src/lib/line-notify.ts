export async function sendLineNotify(message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const groupId = process.env.LINE_GROUP_ID;
  
  if (!token || !groupId) {
    console.log('LINE credentials missing, skipping notification.');
    return;
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        to: groupId,
        messages: [{
          type: 'text',
          text: message
        }]
      })
    });

    if (!response.ok) {
      console.error('Failed to send LINE Message:', await response.text());
    } else {
      console.log('LINE Message sent successfully.');
    }
  } catch (error) {
    console.error('Error sending LINE Message:', error);
  }
}
