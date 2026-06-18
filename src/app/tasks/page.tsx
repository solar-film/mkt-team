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
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fff1f2', border: '2px solid #fda4af', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.9rem', color: '#be123c', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.2), 0 2px 4px -1px rgba(225, 29, 72, 0.1)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                <span className="animate-bounce" style={{ display: 'inline-block', fontSize: '1.2rem' }}>🚨</span>
                <span className="animate-pulse" style={{ width: '8px', height: '8px', backgroundColor: '#e11d48', borderRadius: '50%', display: 'inline-block' }}></span>
                <strong style={{ fontWeight: 800 }}>{e.time ? `วันนี้ ${e.time}:` : 'วันนี้:'}</strong>
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
