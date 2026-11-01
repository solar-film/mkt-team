'use client';

import { useState } from 'react';
import TaskBoard from '@/components/TaskBoard';
import styles from './tasks.module.css';

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
          <div className={styles.events} aria-label="กิจกรรมวันนี้และพรุ่งนี้">
            {displayEvents.map((e, index) => (
              <div key={e.id || index} className={styles.event} title={`${e.dateLabel} ${e.title}`}>
                <span className={`animate-custom-pulse ${styles.dot}`} aria-hidden />
                <strong>{e.dateLabel}</strong>
                <span className={styles.eventTitle}>{e.title}</span>
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
