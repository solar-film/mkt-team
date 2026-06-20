'use client';

import { useState } from 'react';
import TaskBoard from '@/components/TaskBoard';

export default function UnifiedTasksPage() {
  const [displayEvents, setDisplayEvents] = useState<any[]>([]);
  return (
    <div>
      <style>{`
        @keyframes custom-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.3); }
        }
        .animate-custom-pulse {
          animation: custom-pulse 1.2s ease-in-out infinite;
        }
      `}</style>
      <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="page-header-content">
          <h1>จัดการงาน & คอนเท้น</h1>
          <p className="desktop-only">ติดตามสถานะงานของทุกคนในทีมและวางแผนการตลาดในบอร์ดเดียว</p>
        </div>

        {displayEvents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end', marginTop: '0.25rem' }}>
            {displayEvents.map((e, index) => (
              <div key={e.id || index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fff1f2', border: '2px solid #fda4af', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.9rem', color: '#be123c', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.2), 0 2px 4px -1px rgba(225, 29, 72, 0.1)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                <span className="animate-custom-pulse" style={{ width: '8px', height: '8px', backgroundColor: '#e11d48', borderRadius: '50%', display: 'inline-block' }}></span>
                <strong style={{ fontWeight: 800 }}>{e.dateLabel}</strong>
                <span>{e.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <TaskBoard onEventsChange={setDisplayEvents} />
      </div>
    </div>
  );
}
