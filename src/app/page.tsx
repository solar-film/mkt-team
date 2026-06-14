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

  const fetchData = () => {
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
  };

  useEffect(() => {
    fetchData();
    
    // Auto-refresh data every 2 minutes (120,000 ms)
    const interval = setInterval(() => {
      fetchData();
    }, 120000);
    
    return () => clearInterval(interval);
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
    ? currentMonthKpis.reduce((sum, kpi) => {
        const target = Number(kpi.target) || 1;
        const current = Number(kpi.current) || 0;
        const percentage = (current / target) * 100;
        return sum + (isNaN(percentage) ? 0 : Math.min(percentage, 100));
      }, 0) / currentMonthKpis.length 
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
    <div style={{ padding: '0 0.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', marginTop: '0.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
          สวัสดีวันนี้ 👋
        </h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>
          พร้อมลุยงานให้เป้าหมายวันนี้กัน!
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {/* Card 1: Pending Tasks */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '0.85rem', color: '#1e293b', margin: '0 0 1rem 0', fontWeight: 700 }}>งานค้าง</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f97316' }}>{totalTasks - completedTasks}</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>งาน</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>จากทั้งหมด {totalTasks} งาน</p>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', width: '32px', height: '32px', backgroundColor: '#fff7ed', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
            <HiClipboardDocumentList size={18} />
          </div>
        </div>

        {/* Card 2: Total Content */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '0.85rem', color: '#1e293b', margin: '0 0 1rem 0', fontWeight: 700 }}>คอนเท้นที่ผลิต</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#3b82f6' }}>{totalContent}</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>คอนเท้น</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>จากทั้งหมดในระบบ</p>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', width: '32px', height: '32px', backgroundColor: '#eff6ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <HiDocumentText size={18} />
          </div>
        </div>

        {/* Card 3: Done Tasks */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '0.85rem', color: '#1e293b', margin: '0 0 1rem 0', fontWeight: 700 }}>งานเสร็จแล้ว</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>{completedTasks}</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>งาน</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: '#10b981', margin: '0.25rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <HiCheckCircle size={12} /> ปิดจ๊อบสำเร็จ
          </p>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', width: '32px', height: '32px', backgroundColor: '#ecfdf5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"></path></svg>
          </div>
        </div>

        {/* Card 4: KPI */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '0.85rem', color: '#1e293b', margin: '0 0 1rem 0', fontWeight: 700 }}>ความคืบหน้า KPI</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#8b5cf6' }}>{Math.round(avgKPI || 0)}</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>%</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: '#8b5cf6', margin: '0.25rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <HiChartBar size={12} /> เดือนนี้
          </p>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', width: '32px', height: '32px', backgroundColor: '#f5f3ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
            <HiChartBar size={18} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        {/* Important Tasks */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>งานที่ใกล้ถึงกำหนดส่ง</h2>
            <span style={{ backgroundColor: '#fff7ed', color: '#f97316', padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700 }}>
              {upcomingTasks.length} งาน
            </span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {upcomingTasks.length > 0 ? upcomingTasks.map((task, index) => {
              const isTask = task.itemType === 'task';
              const colors = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899', '#06b6d4'];
              const color = isTask ? colors[index % colors.length] : ((task as any).platform === 'Facebook' ? '#3b82f6' : '#ec4899');
              
              return (
                <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 0', borderBottom: index < upcomingTasks.length - 1 ? '1px dashed #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: `${color}15`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isTask ? <HiClipboardDocumentList size={14} /> : <HiDocumentText size={14} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</h4>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.memberName}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, paddingLeft: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: color, fontWeight: 600, opacity: 0.8 }}>
                      {new Date(task.deadline!).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    </span>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color }}></div>
                  </div>
                </div>
              );
            }) : (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>ไม่มีงานที่ใกล้ถึงกำหนดส่ง 🎉</div>
            )}
          </div>
        </div>

        {/* Team Performance */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>ผลงานทีมงาน</h2>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', color: '#64748b' }}>
              เดือนนี้ <span>▼</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {members.filter(m => m.status !== 'inactive').map((member, index) => {
              const memberKpis = member.kpis.filter(k => k.month === currentMonth && k.year === currentYear);
              const memberAvgKpi = memberKpis.length > 0 
                ? memberKpis.reduce((sum, k) => {
                    const target = Number(k.target) || 1;
                    const current = Number(k.current) || 0;
                    const percentage = (current / target) * 100;
                    return sum + (isNaN(percentage) ? 0 : Math.min(percentage, 100));
                  }, 0) / memberKpis.length 
                : 0;
              const doneTasks = member.tasks.filter(t => t.status === 'done').length;
              const doneContents = member.contents.filter(c => c.status === 'published').length;

              return (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 0', borderBottom: index < members.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <MemberAvatar name={member.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>{member.name}</span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{member.role}</span>
                    </div>
                    <ProgressBar value={memberAvgKpi} showPercentage={false} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ minWidth: '40px' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{doneTasks}</div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>งาน</div>
                    </div>
                    <div style={{ minWidth: '40px' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{doneContents}</div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>คอนเท้น</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
