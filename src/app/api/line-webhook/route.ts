import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const events = body.events || []

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text
        if (text === '!id') {
          // สามารถเป็น groupId หรือ userId ได้ (ในกรณีที่แชทส่วนตัว)
          const sourceId = event.source.groupId || event.source.roomId || event.source.userId
          const replyToken = event.replyToken

          // ตอบกลับไปบอก ID
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
              replyToken: replyToken,
              messages: [{
                type: 'text',
                text: `รหัสกลุ่มของคุณคือ:\n${sourceId}\n\nให้นำรหัสนี้ไปก๊อปปี้ใส่ใน Vercel ช่อง LINE_GROUP_ID ได้เลยค่ะ!`
              }]
            })
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook Error:', error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}
