'use client';

import TaskBoard from '@/components/TaskBoard';

export default function UnifiedTasksPage() {
  return (
    <div>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="page-header-content">
          <h1>จัดการงาน & คอนเท้น</h1>
          <p>ติดตามสถานะงานของทุกคนในทีมและวางแผนการตลาดในบอร์ดเดียว</p>
        </div>
      </div>

      <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <TaskBoard />
      </div>
    </div>
  );
}
