'use client';

import { useEffect, useState } from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';

interface TeamMember {
  id: string; name: string; role: string; avatar: string | null; status: string;
}

interface UnifiedItem {
  id: string; title: string; status: string; memberId: string; date: string; type: 'task' | 'content';
  member?: { name: string; avatar: string | null; };
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [resTasks, resContent, resMembers] = await Promise.all([
          fetch('/api/tasks'),
          fetch('/api/content'),
          fetch('/api/members')
        ]);
        const tasks = await resTasks.json();
        const contents = await resContent.json();
        const members: TeamMember[] = await resMembers.json();

        const unified: UnifiedItem[] = [];
        
        tasks.forEach((t: any) => {
          if (t.deadline) {
            unified.push({
              id: t.id, title: t.title, status: t.status, memberId: t.memberId,
              date: t.deadline.split('T')[0], type: 'task',
              member: members.find(m => m.id === t.memberId)
            });
          }
        });

        contents.forEach((c: any) => {
          if (c.publishDate) {
            unified.push({
              id: c.id, title: c.title, status: c.status, memberId: c.memberId,
              date: c.publishDate.split('T')[0], type: 'content',
              member: members.find(m => m.id === c.memberId)
            });
          }
        });

        setItems(unified);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const daysOfWeek = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const gridCells = [];
  
  // Pad beginning
  for (let i = 0; i < firstDay; i++) {
    gridCells.push(<div key={`empty-start-${i}`} className="calendar-cell empty-cell"></div>);
  }

  // Days
  const todayStr = new Date().toISOString().split('T')[0];
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayItems = items.filter(item => item.date === dateStr);
    
    gridCells.push(
      <div key={`day-${i}`} className={`calendar-cell ${dateStr === todayStr ? 'today' : ''}`}>
        <div className="calendar-date-number">{i}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {dayItems.map(item => (
            <div key={`${item.type}-${item.id}`} className={`calendar-task-item status-${item.status}`} title={`${item.title} (${item.member?.name || 'ไม่ระบุ'})`}>
              {item.member && (
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>
                  {item.member.name.charAt(0)}
                </div>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Pad end to complete the grid (usually 35 or 42 cells total)
  const totalCells = gridCells.length;
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remainingCells; i++) {
    gridCells.push(<div key={`empty-end-${i}`} className="calendar-cell empty-cell"></div>);
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div className="page-header-content">
          <h1>ปฏิทินงาน</h1>
          <p>ดูภาพรวมงานและกำหนดส่งทั้งหมดในแต่ละเดือน</p>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <div className="calendar-controls">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>
            {thaiMonths[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={prevMonth}>
              <HiChevronLeft />
            </button>
            <button className="btn btn-secondary" onClick={() => setCurrentDate(new Date())}>
              เดือนนี้
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={nextMonth}>
              <HiChevronRight />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-container" style={{ minHeight: '400px' }}><div className="loading-spinner"></div></div>
        ) : (
          <div className="calendar-grid">
            {daysOfWeek.map(day => (
              <div key={day} className="calendar-header-cell">{day}</div>
            ))}
            {gridCells}
          </div>
        )}
        
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', borderLeft: '3px solid var(--color-success)', backgroundColor: 'white', border: '1px solid var(--color-border)' }}></div>
            <span>เสร็จแล้ว</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', borderLeft: '3px solid var(--color-warning)', backgroundColor: 'white', border: '1px solid var(--color-border)' }}></div>
            <span>กำลังทำ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', borderLeft: '3px solid var(--color-border)', backgroundColor: 'white', border: '1px solid var(--color-border)' }}></div>
            <span>รอดำเนินการ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
