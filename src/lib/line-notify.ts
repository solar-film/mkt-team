export async function sendLineNotify(message: string) {
  const token = process.env.LINE_NOTIFY_TOKEN;
  
  if (!token) {
    console.log('LINE_NOTIFY_TOKEN is not set, skipping notification.');
    return;
  }

  try {
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token}`
      },
      body: new URLSearchParams({
        message: message
      })
    });

    if (!response.ok) {
      console.error('Failed to send LINE Notify:', await response.text());
    } else {
      console.log('LINE Notify sent successfully.');
    }
  } catch (error) {
    console.error('Error sending LINE Notify:', error);
  }
}
