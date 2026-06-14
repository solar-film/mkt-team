import { NextResponse } from 'next/server';
import { initDoc } from '@/lib/google-sheets';
import { sendLineNotify } from '@/lib/line-notify';

// Vercel cron uses GET
export async function GET(request: Request) {
  // Optional security: check authorization header if provided by Vercel
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const doc = await initDoc();
    
    // Fetch members for names
    const membersSheet = doc.sheetsByTitle['TeamMember'];
    let members: {id: string, name: string}[] = [];
    if (membersSheet) {
      const mRows = await membersSheet.getRows();
      members = mRows.map(r => ({ id: r.get('id') || '', name: r.get('name') || '' }));
    }

    // Fetch tasks
    const tasksSheet = doc.sheetsByTitle['Task'];
    if (!tasksSheet) return NextResponse.json({ message: 'No tasks sheet' });
    
    const rows = await tasksSheet.getRows();
    const now = new Date();
    // Normalize to start of day for comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let upcomingTasks: { title: string, deadline: Date, memberName: string, diffDays: number }[] = [];

    rows.forEach(row => {
      const status = row.get('status');
      if (status === 'done') return; // skip done

      const deadlineStr = row.get('deadline');
      if (!deadlineStr) return;

      const deadline = new Date(deadlineStr);
      const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());

      // If deadline is today, tomorrow, or past due
      const diffTime = deadlineDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 2) { // Notify 2 days before, 1 day before, today, and overdue
        const memberId = row.get('memberId');
        const member = members.find(m => m.id === memberId);
        const memberName = member ? member.name : 'ไม่ระบุ';
        
        upcomingTasks.push({
          title: row.get('title') || '',
          deadline: deadlineDate,
          memberName: memberName,
          diffDays
        });
      }
    });

    if (upcomingTasks.length > 0) {
      // Sort by overdue first
      upcomingTasks.sort((a, b) => a.diffDays - b.diffDays);
      
      let message = `\n⏰ แจ้งเตือนงานใกล้กำหนดส่ง/เกินกำหนด!\n`;
      upcomingTasks.forEach(t => {
        let statusStr = '';
        if (t.diffDays < 0) statusStr = '🚨 (เลยกำหนด)';
        else if (t.diffDays === 0) statusStr = '🔥 (ส่งวันนี้)';
        else if (t.diffDays === 1) statusStr = '⚠️ (พรุ่งนี้)';
        else if (t.diffDays === 2) statusStr = '⏳ (อีก 2 วัน)';
        
        message += `\n- ${t.title} ${statusStr}\n👤 รับผิดชอบ: ${t.memberName}\n`;
      });
      
      await sendLineNotify(message);
    }

    return NextResponse.json({ success: true, notified: upcomingTasks.length });
  } catch (error) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: 'Failed to run cron' }, { status: 500 });
  }
}
