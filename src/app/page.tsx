'use client';

import { useEffect, useState } from 'react';
import { 
  HiClipboardDocumentList, 
  HiCheckCircle, 
  HiDocumentText, 
  HiChartBar 
} from 'react-icons/hi2';
import StatsCard from '@/components/StatsCard';
import MemberAvatar from '@/components/MemberAvatar';
import ProgressBar from '@/components/ProgressBar';

interface Task {
  id: string; title: string; description: string | null; status: string;
  priority: string; deadline: string | null; memberId: string;
}
interface KPI {
  id: string; name: string; target: number; current: number;
  unit: string; month: number; year: number; memberId: string;
}
interface Content {
  id: string; title: string; type: string; platform: string;
  status: string; publishDate: string | null; memberId: string;
}
interface TeamMember {
  id: string; name: string; role: string; avatar: string | null; status: string;
  tasks: Task[]; kpis: KPI[]; contents: Content[];
}

export default function DashboardPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/members?includeRelations=true')
      .then(res => res.json())
      .then(data => {
        if (data && data.error) {
          setError(data.error);
          setMembers([]);
        } else if (Array.isArray(data)) {
          setMembers(data);
        } else {
          setMembers([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ margin: '2rem', padding: '2rem', textAlign: 'center', borderColor: 'var(--color-danger)' }}>
        <h2 style={{ color: 'var(--color-danger)' }}>เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล</h2>
        <p style={{ marginTop: '1rem' }}>{error}</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
          ระบบไม่สามารถอ่านข้อมูลจาก Google Sheets ได้ กรุณาตรวจสอบว่าคุณได้ <b>Enable (เปิดใช้งาน) Google Sheets API</b> ในหน้า Google Cloud Console ตามขั้นตอนที่ 2 แล้วหรือยัง
        </p>
      </div>
    );
  }

  // Calculate overall stats
  const totalTasks = members.reduce((sum, m) => sum + m.tasks.length, 0);
  const completedTasks = members.reduce((sum, m) => sum + m.tasks.filter(t => t.status === 'done').length, 0);
  const totalContent = members.reduce((sum, m) => sum + m.contents.length, 0);
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const currentMonthKpis = members.flatMap(m => m.kpis).filter(k => k.month === currentMonth && k.year === currentYear);
  const avgKPI = currentMonthKpis.length > 0 
    ? currentMonthKpis.reduce((sum, kpi) => sum + Math.min((kpi.current / kpi.target) * 100, 100), 0) / currentMonthKpis.length 
    : 0;

  // Get recent tasks sorted by deadline
  const allTasks = members.flatMap(m => m.tasks.map(t => ({ ...t, memberName: m.name, itemType: 'task' })));
  const allContents = members.flatMap(m => m.contents.map(c => ({ ...c, memberName: m.name, itemType: 'content', deadline: c.publishDate })));
  const upcomingTasks = [...allTasks, ...allContents]
    .filter(t => t.deadline && t.status !== 'done')
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 8);

  const getPriorityBadge = (priority: string) => {
    switch(priority) {
      case 'high': return <span className="badge priority-high">สูง</span>;
      case 'medium': return <span className="badge priority-medium">กลาง</span>;
      case 'low': return <span className="badge priority-low">ต่ำ</span>;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'todo': return <span className="badge badge-draft">รอดำเนินการ</span>;
      case 'in_progress': return <span className="badge badge-article">กำลังทำ</span>;
      case 'done': return <span className="badge badge-published">เสร็จแล้ว</span>;
      default: return null;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1>แดชบอร์ด</h1>
          <p>ภาพรวมทีมการตลาดและคอนเท้น</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatsCard 
          title="งานทั้งหมด" 
          value={totalTasks} 
          icon={<HiClipboardDocumentList />} 
          color="primary" 
        />
        <StatsCard 
          title="งานเสร็จแล้ว" 
          value={completedTasks} 
          icon={<HiCheckCircle />} 
          color="success" 
        />
        <StatsCard 
          title="คอนเท้นที่ผลิต" 
          value={totalContent} 
          icon={<HiDocumentText />} 
          color="secondary" 
        />
        <StatsCard 
          title="ความคืบหน้า KPI รวม (เดือนนี้)" 
          value={`${Math.round(avgKPI)}%`} 
          icon={<HiChartBar />} 
          color="warning" 
        />
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h2>ผลงานทีมงาน</h2>
          </div>
          <div className="card-body">
            <div className="team-performance-list">
              {members.filter(m => m.status !== 'inactive').map(member => {
                const memberKpis = member.kpis.filter(k => k.month === currentMonth && k.year === currentYear);
                const memberAvgKpi = memberKpis.length > 0 
                  ? memberKpis.reduce((sum, k) => sum + Math.min((k.current / k.target) * 100, 100), 0) / memberKpis.length 
                  : 0;
                const doneTasks = member.tasks.filter(t => t.status === 'done').length;
                const doneContents = member.contents.filter(c => c.status === 'published').length;

                return (
                  <div key={member.id} className="member-stats-mini" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                    <MemberAvatar name={member.name} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 500 }}>{member.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{member.role}</span>
                      </div>
                      <ProgressBar value={memberAvgKpi} showPercentage={false} />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', textAlign: 'right' }}>
                      <div style={{ minWidth: '50px' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{doneTasks}/{member.tasks.length}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>งานเสร็จ</div>
                      </div>
                      <div style={{ minWidth: '50px' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{doneContents}/{member.contents.length}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>คอนเท้น</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>งานที่ใกล้ถึงกำหนด</h2>
          </div>
          <div className="card-body">
            {upcomingTasks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {upcomingTasks.map(task => (
                  <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{task.title}</h4>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{task.memberName}</span>
                        •
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>
                          กำหนดส่ง: {new Date(task.deadline!).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column', alignItems: 'flex-end' }}>
                      {task.itemType === 'task' ? getPriorityBadge((task as any).priority) : <span className="badge badge-secondary">คอนเท้น</span>}
                      {getStatusBadge(task.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>ไม่มีงานที่ใกล้ถึงกำหนด</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
