'use client';

import { useEffect, useState } from 'react';
import TaskBoard from '@/components/TaskBoard';

export default function UnifiedTasksPage() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/events').then(res => res.json()).then(data => {
      if (Array.isArray(data)) setEvents(data);
    });
  }, []);

  const todayEvents = events.filter(e => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const eventDate = new Date(e.date);
    eventDate.setHours(0,0,0,0);
    return eventDate.getTime() === today.getTime();
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="page-header-content">
          <h1>จัดการงาน & คอนเท้น</h1>
          <p className="desktop-only">ติดตามสถานะงานของทุกคนในทีมและวางแผนการตลาดในบอร์ดเดียว</p>
        </div>

        {todayEvents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end', marginTop: '0.25rem' }}>
            {todayEvents.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem', color: '#1d4ed8', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', whiteSpace: 'nowrap' }}>
                <span>🔔</span>
                <strong style={{ fontWeight: 600 }}>{e.time ? `วันนี้ ${e.time}:` : 'วันนี้:'}</strong>
                <span>{e.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <TaskBoard />
      </div>
    </div>
  );
}
