'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  HiClipboardDocumentList, 
  HiCheckCircle, 
  HiDocumentText, 
  HiChartBar 
} from 'react-icons/hi2';
import StatsCard from '@/components/StatsCard';
import MemberAvatar from '@/components/MemberAvatar';
import ProgressBar from '@/components/ProgressBar';
import { getCompanyColor } from '@/lib/colors';

interface Task {
  id: string; title: string; description: string | null; status: string;
  priority: string; deadline: string | null; memberId: string; company?: string;
}
interface KPI {
  id: string; name: string; target: number; current: number;
  unit: string; month: number; year: number; memberId: string;
}
interface Content {
  id: string; title: string; type: string; platform: string;
  status: string; publishDate: string | null; memberId: string; company?: string;
}
interface TeamMember {
  id: string; name: string; role: string; avatar: string | null; status: string;
  tasks: Task[]; kpis: KPI[]; contents: Content[];
}

export default function DashboardPage() {
  const { currentUserId } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMemberId, setFilterMemberId] = useState<string>('my_tasks');

  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    fetch('/api/members?includeRelations=true', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data && data.error) {
          setError(data.details ? `[Error]: ${data.details}` : data.error);
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

  useEffect(() => {
    if (currentUserId && filterMemberId === 'my_tasks' && members.length > 0) {
      setFilterMemberId(currentUserId);
    }
  }, [currentUserId, members]);

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
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)', wordBreak: 'break-all', textAlign: 'left', background: '#ffebee', padding: '10px', borderRadius: '5px' }}>
          {error.includes('[Error]') ? error : 'ระบบไม่สามารถเชื่อมต่อกับฐานข้อมูล Supabase ได้ กรุณาตรวจสอบการตั้งค่า DATABASE_URL ใน Vercel'}
        </p>
      </div>
    );
  }

  const currentUser = members.find(m => m.id === currentUserId);
  const selectedUser = members.find(m => m.id === filterMemberId);
  const targetName = filterMemberId === 'all' ? 'ทีมงาน' : (selectedUser?.name || '');

  const filteredMembers = filterMemberId === 'all' 
    ? members 
    : members.filter(m => m.id === filterMemberId);

  // Calculate overall stats
  const totalTasks = filteredMembers.reduce((sum, m) => sum + m.tasks.length, 0);
  const completedTasks = filteredMembers.reduce((sum, m) => sum + m.tasks.filter(t => t.status === 'done').length, 0);
  const totalContent = filteredMembers.reduce((sum, m) => sum + m.contents.length, 0);
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const currentMonthKpis = filteredMembers.flatMap(m => m.kpis).filter(k => k.month === currentMonth && k.year === currentYear);
  const avgKPI = currentMonthKpis.length > 0 
    ? currentMonthKpis.reduce((sum, kpi) => {
        const target = Number(kpi.target) || 1;
        const current = Number(kpi.current) || 0;
        const percentage = (current / target) * 100;
        return sum + (isNaN(percentage) ? 0 : Math.min(percentage, 100));
      }, 0) / currentMonthKpis.length 
    : 0;

  // Get recent tasks sorted by deadline
  const allTasks = filteredMembers.flatMap(m => m.tasks.map(t => ({ ...t, memberName: m.name, itemType: 'task' })));
  const allContents = filteredMembers.flatMap(m => m.contents.map(c => ({ ...c, memberName: m.name, itemType: 'content', deadline: c.publishDate })));
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
    <div style={{ padding: '0 0.5rem', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
            สวัสดีวันนี้คุณ {currentUser?.name || ''} 👋
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>
            พร้อมลุยงานให้เป้าหมายวันนี้กัน!
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>กำลังดูข้อมูลของ:</span>
          <select 
            value={filterMemberId}
            onChange={e => setFilterMemberId(e.target.value)}
            style={{ padding: '0.5rem 1rem', borderRadius: '24px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#475569', outline: 'none', fontWeight: 600 }}
          >
            <option value="all">ดูผลรวมของทีม</option>
            {members.filter(m => m.status !== 'inactive' && m.role !== 'Admin').map(m => (
              <option key={m.id} value={m.id}>{m.name} {m.id === currentUserId ? '(ฉัน)' : ''}</option>
            ))}
          </select>
        </div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Team Performance */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>ผลงาน{targetName}</h2>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', color: '#64748b' }}>
              เดือนนี้ <span>▼</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {filteredMembers.filter(m => m.status !== 'inactive' && m.role !== 'Admin').map((member, index) => {
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
              const unfinishedTasks = member.tasks.filter(t => t.status !== 'done').length;
              const doneContents = member.contents.filter(c => c.status === 'done').length;
              const unfinishedContents = member.contents.filter(c => c.status !== 'done').length;

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
                  <div style={{ display: 'flex', gap: '0.5rem', textAlign: 'left', flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#fff7ed', padding: '0.4rem 0.6rem', borderRadius: '8px', minWidth: '75px' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ea580c', marginBottom: '0.3rem', textAlign: 'center' }}>รอดำเนินการ</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', gap: '0.5rem' }}>
                        <span>งาน:</span> <strong style={{ color: '#ea580c' }}>{unfinishedTasks}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', gap: '0.5rem' }}>
                        <span>คอนเท้น:</span> <strong style={{ color: '#ea580c' }}>{unfinishedContents}</strong>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#f0fdf4', padding: '0.4rem 0.6rem', borderRadius: '8px', minWidth: '75px' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#16a34a', marginBottom: '0.3rem', textAlign: 'center' }}>เสร็จแล้ว</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', gap: '0.5rem' }}>
                        <span>งาน:</span> <strong style={{ color: '#16a34a' }}>{doneTasks}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', gap: '0.5rem' }}>
                        <span>คอนเท้น:</span> <strong style={{ color: '#16a34a' }}>{doneContents}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Company Work Summary */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>สรุปผลงาน{filterMemberId !== 'all' ? 'ของ ' + targetName : 'รายบุคคล'}แยกตามบริษัท</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#64748b', fontSize: '0.8rem' }}>ผู้รับผิดชอบ</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>GFS</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>MHL</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>CAR</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.filter(m => m.status !== 'inactive' && m.role !== 'Admin').map((member, index) => {
                  const getStats = (company: string) => {
                    const cTasks = member.tasks.filter(t => t.company === company);
                    const cContents = member.contents.filter(c => c.company === company);
                    return { t: cTasks.length, c: cContents.length };
                  };
                  const gfs = getStats('GFS');
                  const mhl = getStats('MHL');
                  const car = getStats('CAR');

                  const renderStats = (stats: {t: number, c: number}) => {
                    if (stats.t === 0 && stats.c === 0) return <span style={{ color: '#cbd5e1' }}>-</span>;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                        {stats.t > 0 && <span style={{ fontSize: '0.7rem', backgroundColor: '#eff6ff', color: '#3b82f6', padding: '0.15rem 0.5rem', borderRadius: '10px', fontWeight: 600 }}>{stats.t} งาน</span>}
                        {stats.c > 0 && <span style={{ fontSize: '0.7rem', backgroundColor: '#fdf4ff', color: '#d946ef', padding: '0.15rem 0.5rem', borderRadius: '10px', fontWeight: 600 }}>{stats.c} คอนเทนต์</span>}
                      </div>
                    );
                  };

                  const activeMembersCount = members.filter(m => m.status !== 'inactive').length;

                  return (
                    <tr key={member.id} style={{ borderBottom: index < activeMembersCount - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <MemberAvatar name={member.name} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{member.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{renderStats(gfs)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{renderStats(mhl)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{renderStats(car)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
              const color = getCompanyColor((task as any).company);
              
              return (
                <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 0', borderBottom: index < upcomingTasks.length - 1 ? '1px dashed #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: `${color}15`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isTask ? <HiClipboardDocumentList size={14} /> : <HiDocumentText size={14} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {task.company ? <span style={{ color: color, marginRight: '4px' }}>[{task.company}]</span> : null}
                        {task.title}
                      </h4>
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

      </div>
    </div>
  );
}
