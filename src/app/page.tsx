'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  HiClipboardDocumentList, 
  HiCheckCircle, 
  HiDocumentText, 
  HiChartBar,
  HiOutlineExclamationTriangle,
  HiOutlinePaperAirplane,
  HiOutlineUserGroup,
  HiOutlineChartBarSquare
} from 'react-icons/hi2';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import StatsCard from '@/components/StatsCard';
import MemberAvatar from '@/components/MemberAvatar';
import ProgressBar from '@/components/ProgressBar';
import { getCompanyColor } from '@/lib/colors';

interface Task {
  id: string; title: string; description: string | null; status: string;
  priority: string; deadline: string | null; memberId: string; company?: string;
  createdAt?: string; updatedAt?: string; kpiId?: string | null;
}
interface KPI {
  id: string; name: string; target: number; current: number;
  unit: string; month: number; year: number; memberId: string;
}
interface Content {
  id: string; title: string; type: string; platform: string;
  status: string; publishDate: string | null; memberId: string; company?: string;
  createdAt?: string; updatedAt?: string; kpiId?: string | null;
}
interface TeamMember {
  id: string; name: string; role: string; avatar: string | null; status: string;
  tasks: Task[]; kpis: KPI[]; contents: Content[];
}

import Link from 'next/link';
import { fetchDashboardCached } from '@/lib/fetchDashboard';

export default function DashboardPage() {
  const { currentUserId } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMemberId, setFilterMemberId] = useState<string>('all');
  const [perfTab, setPerfTab] = useState<'tasks' | 'contents'>('contents');

  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    fetchDashboardCached('/api/dashboard')
      .then(res => res.json())
      .then(data => {
        if (data && data.error) {
          setError(data.details ? `[Error]: ${data.details}` : data.error);
          setMembers([]);
        } else if (data && data.members) {
          const enrichedMembers = data.members.map((m: any) => ({
            ...m,
            tasks: data.tasks?.filter((t: any) => t.memberId === m.id || t.memberId?.includes(m.id)) || [],
            contents: data.contents?.filter((c: any) => c.memberId === m.id || c.memberId?.includes(m.id)) || [],
            kpis: data.kpis?.filter((k: any) => k.memberId === m.id) || []
          }));
          setMembers(enrichedMembers);
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

  const currentMonthKpis = filteredMembers.flatMap(m => m.kpis).filter(k => k.month === currentMonth && k.year === currentYear && k.name !== 'งานทั่วไป');
  const avgKPI = currentMonthKpis.length > 0 
    ? currentMonthKpis.reduce((sum, kpi) => {
        const target = Number(kpi.target) || 1;
        const member = filteredMembers.find(m => m.id === kpi.memberId);
        const linkedTasksDone = member?.tasks?.filter(t => t.kpiId === kpi.id && (t.status === 'done' || t.status === 'เสร็จแล้ว')).length || 0;
        const linkedContentsDone = member?.contents?.filter(c => c.kpiId === kpi.id && (c.status === 'done' || c.status === 'เสร็จแล้ว')).length || 0;
        const autoCurrent = linkedTasksDone + linkedContentsDone;
        const displayCurrent = Math.max(Number(kpi.current) || 0, autoCurrent);
        const percentage = kpi.target === 0 ? (displayCurrent > 0 ? 100 : 0) : (displayCurrent / target) * 100;
        return sum + Math.min(percentage, 100);
      }, 0) / currentMonthKpis.length 
    : 0;

  // Get recent tasks sorted by deadline
  const allTasks = filteredMembers.flatMap(m => m.tasks.map(t => ({ ...t, memberName: m.name, itemType: 'task', memberId: m.id })));
  const allContents = filteredMembers.flatMap(m => m.contents.map(c => ({ ...c, memberName: m.name, itemType: 'content', deadline: c.publishDate, memberId: m.id })));
  const allItems = [...allTasks, ...allContents];
  
  const upcomingTasks = allItems
    .filter(t => t.deadline && t.status !== 'done')
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);

  // --- NEW CALCULATIONS ---

  // 1. "From Yesterday" Stats (Items created/updated in last 24h)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const tasksCreatedYesterday = allTasks.filter(t => t.createdAt && new Date(t.createdAt) >= yesterday).length;
  const contentCreatedYesterday = allContents.filter(c => c.createdAt && new Date(c.createdAt) >= yesterday).length;
  const tasksCompletedYesterday = allTasks.filter(t => t.status === 'done' && t.updatedAt && new Date(t.updatedAt) >= yesterday).length;

  // 2. 7-Day Trend Data
  const trendData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const nextD = new Date(d);
    nextD.setDate(d.getDate() + 1);

    const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    
    // Real data calculation
    const completed = allTasks.filter(t => t.status === 'done' && t.updatedAt && new Date(t.updatedAt) >= d && new Date(t.updatedAt) < nextD).length;
    const content = allContents.filter(c => c.createdAt && new Date(c.createdAt) >= d && new Date(c.createdAt) < nextD).length;
    const pending = allTasks.filter(t => t.status !== 'done' && t.createdAt && new Date(t.createdAt) >= d && new Date(t.createdAt) < nextD).length;

    return {
      name: dateStr,
      pending,
      content,
      completed,
    };
  });

  // Calculate 7-Day Comparisons for Insight Text
  const last7DaysStart = new Date();
  last7DaysStart.setDate(last7DaysStart.getDate() - 7);
  last7DaysStart.setHours(0, 0, 0, 0);

  const prev7DaysStart = new Date();
  prev7DaysStart.setDate(prev7DaysStart.getDate() - 14);
  prev7DaysStart.setHours(0, 0, 0, 0);

  const tasksCompletedLast7Days = allTasks.filter(t => t.status === 'done' && t.updatedAt && new Date(t.updatedAt) >= last7DaysStart).length;
  const contentCreatedLast7Days = allContents.filter(c => c.createdAt && new Date(c.createdAt) >= last7DaysStart).length;

  const tasksCompletedPrev7Days = allTasks.filter(t => t.status === 'done' && t.updatedAt && new Date(t.updatedAt) >= prev7DaysStart && new Date(t.updatedAt) < last7DaysStart).length;
  const contentCreatedPrev7Days = allContents.filter(c => c.createdAt && new Date(c.createdAt) >= prev7DaysStart && new Date(c.createdAt) < last7DaysStart).length;

  const taskIncrease = tasksCompletedPrev7Days === 0 ? (tasksCompletedLast7Days > 0 ? 100 : 0) : Math.round(((tasksCompletedLast7Days - tasksCompletedPrev7Days) / tasksCompletedPrev7Days) * 100);
  const contentIncrease = contentCreatedPrev7Days === 0 ? (contentCreatedLast7Days > 0 ? 100 : 0) : Math.round(((contentCreatedLast7Days - contentCreatedPrev7Days) / contentCreatedPrev7Days) * 100);

  const taskTrendText = taskIncrease >= 0 ? `เพิ่มขึ้น ${taskIncrease}%` : `ลดลง ${Math.abs(taskIncrease)}%`;
  const taskTrendColor = taskIncrease >= 0 ? '#10b981' : '#ef4444';

  const contentTrendText = contentIncrease >= 0 ? `เพิ่มขึ้น ${contentIncrease}%` : `ลดลง ${Math.abs(contentIncrease)}%`;
  const contentTrendColor = contentIncrease >= 0 ? '#3b82f6' : '#ef4444';

  // 3. Team Performance
  const teamPerformance = members
    .filter(m => m.name.toLowerCase() !== 'oil')
    .map(m => {
      const mItems = perfTab === 'tasks' ? m.tasks : m.contents;
      const mCompleted = mItems.filter(t => t.status === 'done').length;
      const mTotal = mItems.length;
      
      const mKpis = m.kpis.filter(k => k.month === currentMonth && k.year === currentYear && k.name !== 'งานทั่วไป');
      let kpiPercent = 0;
      if (mKpis.length > 0) {
        const totalPercent = mKpis.reduce((sum, kpi) => {
          const target = Number(kpi.target) || 1;
          const linkedTasksDone = m.tasks?.filter(t => t.kpiId === kpi.id && (t.status === 'done' || t.status === 'เสร็จแล้ว')).length || 0;
          const linkedContentsDone = m.contents?.filter(c => c.kpiId === kpi.id && (c.status === 'done' || c.status === 'เสร็จแล้ว')).length || 0;
          const autoCurrent = linkedTasksDone + linkedContentsDone;
          const displayCurrent = Math.max(Number(kpi.current) || 0, autoCurrent);
          const percentage = kpi.target === 0 ? (displayCurrent > 0 ? 100 : 0) : Math.min((displayCurrent / target) * 100, 100);
          return sum + percentage;
        }, 0);
        kpiPercent = Math.round(totalPercent / mKpis.length);
      }

      return {
        name: m.name,
        percent: kpiPercent,
        completed: mCompleted,
        pending: mTotal - mCompleted
      };
    })
    .sort((a, b) => b.percent - a.percent);

  // 4. Company Breakdown
  const companies = ['GFS', 'MHL', 'CAR'];
  const companyData = companies.map(comp => {
    const cItems = allItems.filter(item => item.company === comp);
    const cCompleted = cItems.filter(item => item.status === 'done').length;
    const cTotal = cItems.length;
    const percent = cTotal > 0 ? Math.round((cCompleted / cTotal) * 100) : 0;
    return {
      name: comp,
      total: cTotal,
      completed: cCompleted,
      percent
    };
  });
  
  const totalCompanyItems = companyData.reduce((acc, curr) => acc + curr.total, 0);
  const totalCompanyCompleted = companyData.reduce((acc, curr) => acc + curr.completed, 0);
  const totalCompanyPercent = totalCompanyItems > 0 ? Math.round((totalCompanyCompleted / totalCompanyItems) * 100) : 0;

  // 5. Decisions Today (Actionable Items)
  const contentsPendingReview = allContents.filter(c => c.status === 'รอตรวจ').length;
  const overdueItems = allItems.filter(i => i.deadline && new Date(i.deadline) < new Date() && i.status !== 'done').length;

  const getPriorityBadge = (priority: string) => {
    switch(priority) {
      case 'high': return <span style={{ color: '#ef4444', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600 }}>สูงมาก</span>;
      case 'medium': return <span style={{ color: '#f59e0b', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600 }}>ปานกลาง</span>;
      case 'low': return <span style={{ color: '#10b981', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600 }}>ต่ำ</span>;
      default: return null;
    }
  };

  return (
    <div style={{ padding: '1rem', margin: '0 auto', backgroundColor: '#f8fafc', minHeight: '100vh', borderRadius: '16px' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: '#1e293b' }}>
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
            {members.filter(m => m.status !== 'inactive' && m.role !== 'Admin').sort((a, b) => { const order = ['OIL', 'TEW', 'PLENG', 'NON']; const idxA = order.indexOf(a.name); const idxB = order.indexOf(b.name); if (idxA === -1 && idxB === -1) return a.name.localeCompare(b.name); if (idxA === -1) return 1; if (idxB === -1) return -1; return idxA - idxB; }).map(m => (
              <option key={m.id} value={m.id}>{m.name} {m.id === currentUserId ? '(ฉัน)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Row: 4 Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        
        {/* Card 1: Pending Tasks */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#fff7ed', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
              <HiClipboardDocumentList size={22} />
            </div>
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>งานค้าง</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f97316', lineHeight: 1 }}>{totalTasks - completedTasks}</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, paddingBottom: '0.35rem' }}>งาน</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>จากทั้งหมด {totalTasks} งาน</span>
            <span style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 700, backgroundColor: '#fff7ed', padding: '0.15rem 0.4rem', borderRadius: '8px' }}>▲ {tasksCreatedYesterday} <span style={{ fontWeight: 500 }}>จากเมื่อวาน</span></span>
          </div>
        </div>

        {/* Card 2: Content Produced */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <HiDocumentText size={22} />
            </div>
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>คอนเทนต์ที่ผลิต</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{totalContent}</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, paddingBottom: '0.35rem' }}>คอนเทนต์</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>จากทั้งหมดในระบบ</span>
            <span style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 700, backgroundColor: '#eff6ff', padding: '0.15rem 0.4rem', borderRadius: '8px' }}>▲ {contentCreatedYesterday} <span style={{ fontWeight: 500 }}>จากเมื่อวาน</span></span>
          </div>
        </div>

        {/* Card 3: Completed Tasks */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#ecfdf5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <HiCheckCircle size={22} />
            </div>
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>งานเสร็จแล้ว</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{completedTasks}</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, paddingBottom: '0.35rem' }}>งาน</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ปิดจ๊อบสำเร็จ</span>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, backgroundColor: '#ecfdf5', padding: '0.15rem 0.4rem', borderRadius: '8px' }}>▲ {tasksCompletedYesterday} <span style={{ fontWeight: 500 }}>จากเมื่อวาน</span></span>
          </div>
        </div>

        {/* Card 4: KPI Progress */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#f5f3ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
              <HiChartBar size={22} />
            </div>
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>ความคืบหน้า KPI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#8b5cf6', lineHeight: 1 }}>{Math.round(avgKPI || 0)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>เป้าหมายรายเดือน 100%</span>
          </div>
          {/* Decorative circular progress */}
          <div style={{ position: 'absolute', right: '1.5rem', bottom: '1.5rem', width: '60px', height: '60px', borderRadius: '50%', background: `conic-gradient(#8b5cf6 ${Math.round(avgKPI || 0)}%, #f1f5f9 0)` }}>
            <div style={{ position: 'absolute', inset: '6px', backgroundColor: 'white', borderRadius: '50%' }}></div>
          </div>
        </div>

      </div>

      {/* Middle Row: Chart & Team Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        
        {/* Executive Summary Chart */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HiOutlineChartBarSquare size={24} color="#6366f1" />
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Executive Summary</h2>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>แนวโน้มงานและคอนเทนต์ 7 วันล่าสุด</p>
              </div>
            </div>
            {/* Legend placed manually to match design */}
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f97316' }}></div> งานค้าง
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div> คอนเทนต์ที่ผลิต
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div> งานเสร็จแล้ว
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: '220px', display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Line type="monotone" dataKey="pending" stroke="#f97316" strokeWidth={2} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="content" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Insight Text box */}
            <div style={{ width: '180px', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ color: '#6366f1' }}>✨</span> สรุปภาพรวม
              </div>
              <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                สถิติ 7 วันล่าสุด: งานเสร็จแล้ว <strong style={{ color: taskTrendColor }}>{taskTrendText}</strong> และคอนเทนต์ที่ผลิต <strong style={{ color: contentTrendColor }}>{contentTrendText}</strong> เมื่อเทียบกับสัปดาห์ก่อนหน้า
              </p>
              <Link href="/kpis" style={{ marginTop: 'auto', backgroundColor: 'white', border: '1px solid #c7d2fe', color: '#6366f1', padding: '0.5rem', borderRadius: '24px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'none', textAlign: 'center' }}>
                ดูรายงานเต็มรูปแบบ →
              </Link>
            </div>
          </div>
        </div>

        {/* Team Performance */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HiOutlineUserGroup size={24} color="#6366f1" />
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Team Performance</h2>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button 
                    onClick={() => setPerfTab('tasks')}
                    style={{ background: perfTab === 'tasks' ? '#e0e7ff' : 'transparent', color: perfTab === 'tasks' ? '#4f46e5' : '#64748b', border: 'none', borderRadius: '12px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    งานทั่วไป
                  </button>
                  <button 
                    onClick={() => setPerfTab('contents')}
                    style={{ background: perfTab === 'contents' ? '#e0e7ff' : 'transparent', color: perfTab === 'contents' ? '#4f46e5' : '#64748b', border: 'none', borderRadius: '12px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    คอนเท้น
                  </button>
                </div>
              </div>
            </div>
            <Link href="/team" style={{ textDecoration: 'none', color: '#6366f1', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>ดูทั้งหมด &gt;</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {teamPerformance.map((member, i) => (
              <div key={member.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: i === 0 ? '#10b981' : i === 1 ? '#ec4899' : '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0 }}>
                  {member.name.charAt(0)}
                </div>
                <div style={{ width: '45px', fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>{member.name}</div>
                
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1, height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${member.percent}%`, height: '100%', backgroundColor: i === 0 ? '#10b981' : i === 1 ? '#ec4899' : '#f59e0b', borderRadius: '3px' }}></div>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', minWidth: '35px' }}>{member.percent}%</span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, minWidth: '100px', justifyContent: 'flex-end' }}>
                  <span>เสร็จแล้ว <strong style={{ color: '#3b82f6' }}>{member.completed}</strong></span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span>ค้าง <strong style={{ color: '#f97316' }}>{member.pending}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Bottom Row: 2 columns (Expanded Upcoming Tasks) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
        
        {/* Upcoming Tasks */}
        <div style={{ flex: '2 1 500px', backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HiOutlineExclamationTriangle size={22} color="#ef4444" />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>งานใกล้ถึงกำหนดส่ง</h2>
              <span style={{ backgroundColor: '#fef2f2', color: '#ef4444', padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.5rem' }}>
                {upcomingTasks.length} งาน
              </span>
            </div>
          </div>
          
          <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>งาน</th>
                <th style={{ textAlign: 'center', padding: '0.5rem 0', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ทีม</th>
                <th style={{ textAlign: 'center', padding: '0.5rem 0', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ความสำคัญ</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>กำหนดส่ง</th>
              </tr>
            </thead>
            <tbody>
              {upcomingTasks.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: i < upcomingTasks.length - 1 ? '1px dashed #f1f5f9' : 'none' }}>
                  <td style={{ padding: '0.75rem 0', maxWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '20px', height: '20px', backgroundColor: t.itemType === 'task' ? '#fff7ed' : '#eff6ff', color: t.itemType === 'task' ? '#f97316' : '#3b82f6', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {t.itemType === 'task' ? <HiClipboardDocumentList size={12} /> : <HiDocumentText size={12} />}
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 0', textAlign: 'center', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{t.memberName}</td>
                  <td style={{ padding: '0.75rem 0', textAlign: 'center' }}>{getPriorityBadge((t as any).priority || 'medium')}</td>
                  <td style={{ padding: '0.75rem 0', textAlign: 'right', fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>
                    {new Date(t.deadline!).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          <Link href="/tasks" style={{ marginTop: 'auto', alignSelf: 'flex-start', color: '#6366f1', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', padding: '1rem 0 0 0', textDecoration: 'none' }}>ดูทั้งหมด &gt;</Link>
        </div>

        {/* Company Breakdown */}
        <div style={{ flex: '1 1 300px', backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <HiOutlineChartBarSquare size={24} color="#8b5cf6" />
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Company Breakdown</h2>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>ผลงานตามบริษัท</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: '45px' }}>บริษัท</div>
              <div style={{ width: '70px', textAlign: 'center' }}>งานทั้งหมด</div>
              <div style={{ width: '70px', textAlign: 'center' }}>เสร็จแล้ว</div>
              <div style={{ flex: 1, textAlign: 'center' }}>ความคืบหน้า</div>
            </div>

            {companyData.map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                <div style={{ width: '45px' }}>{c.name}</div>
                <div style={{ width: '70px', textAlign: 'center' }}>{c.total} <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>งาน</span></div>
                <div style={{ width: '70px', textAlign: 'center' }}>{c.completed} <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>งาน</span></div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1, height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${c.percent}%`, height: '100%', backgroundColor: c.name === 'GFS' ? '#3b82f6' : c.name === 'MHL' ? '#a855f7' : '#f97316', borderRadius: '4px' }}></div>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#8b5cf6', width: '35px', textAlign: 'right' }}>{c.percent}%</span>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px dashed #e2e8f0' }}>
              <div style={{ width: '60px', color: '#64748b' }}>รวมทั้งหมด</div>
              <div style={{ width: '55px', textAlign: 'center' }}>{totalCompanyItems} <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>งาน</span></div>
              <div style={{ width: '70px', textAlign: 'center' }}>{totalCompanyCompleted} <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>งาน</span></div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ flex: 1, height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalCompanyPercent}%`, height: '100%', backgroundColor: '#8b5cf6', borderRadius: '4px' }}></div>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#8b5cf6', width: '35px', textAlign: 'right' }}>{totalCompanyPercent}%</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
