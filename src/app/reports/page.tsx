'use client';

import { useEffect, useState } from 'react';
import { HiChartPie, HiFunnel, HiCalendar, HiUser, HiTag, HiClipboardDocumentList, HiDocumentText, HiArrowTopRightOnSquare } from 'react-icons/hi2';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import { getCompanyColor } from '@/lib/colors';

interface Task {
  id: string; title: string; description: string | null; status: string;
  priority: string; deadline: string | null; platform?: string;
  link?: string;
  kpiId?: string;
  createdAt?: string | null;
}
interface KPI {
  id: string; name: string; target: number; current: number;
  unit: string; month: number; year: number; memberId: string;
}
interface Content {
  id: string; title: string; type: string; platform: string;
  status: string; publishDate: string | null; memberId: string; priority: string;
  link?: string;
  kpiId?: string;
  createdAt?: string | null;
}
interface TeamMember {
  id: string; name: string; role: string; avatar: string | null; status: string;
  tasks: Task[]; kpis: KPI[]; contents: Content[];
}

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  if (hours === '00' && minutes === '00') return datePart;
  return `${datePart} ${hours}:${minutes}`;
}

export default function ReportsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [memberFilter, setMemberFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [showBrandStats, setShowBrandStats] = useState(true);
  
  const currentDate = new Date();
  const [dateFilterType, setDateFilterType] = useState('month'); // 'month' or 'day' or 'all'
  const [dateMonth, setDateMonth] = useState((currentDate.getMonth() + 1).toString());
  const [dateYear, setDateYear] = useState(currentDate.getFullYear().toString());
  const [dateDay, setDateDay] = useState(currentDate.toISOString().split('T')[0]);

  useEffect(() => {
    fetch('/api/dashboard?t=' + Date.now(), { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data && data.members) {
          const enrichedMembers = data.members.map((m: any) => ({
            ...m,
            tasks: data.tasks?.filter((t: any) => t.memberId === m.id || t.memberId?.includes(m.id)) || [],
            contents: data.contents?.filter((c: any) => c.memberId === m.id || c.memberId?.includes(m.id)) || [],
            kpis: data.kpis?.filter((k: any) => k.memberId === m.id) || []
          }));
          setMembers(enrichedMembers);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner"></div></div>;
  }

  // Flatten data
  let allItems: any[] = [];
  members.forEach(m => {
    if (m.status === 'inactive') return;
    
    m.tasks.forEach(t => {
      allItems.push({
        ...t,
        memberName: m.name,
        memberId: m.id,
        itemType: 'task',
        kpiId: t.kpiId,
        date: t.deadline
      });
    });
    
    m.contents.forEach(c => {
      allItems.push({
        ...c,
        memberName: m.name,
        memberId: m.id,
        itemType: 'content',
        kpiId: c.kpiId,
        date: c.publishDate
      });
    });
  });

  // Apply filters
  let filteredItems = allItems.filter(item => {
    // 1. Member Filter
    if (memberFilter !== 'all' && item.memberId !== memberFilter) return false;
    
    // 2. Type Filter
    if (typeFilter !== 'all' && item.itemType !== typeFilter) return false;
    
    // 3. Status Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'done') {
        if (item.status !== 'done' && item.status !== 'published' && item.status !== 'เสร็จแล้ว') return false;
      } else {
        if (item.status !== statusFilter) return false;
      }
    }
    
    // Company Filter
    if (companyFilter !== 'all') {
      if (item.company !== companyFilter) return false;
    }
    
    // 4. Date Filter
    if (dateFilterType !== 'all' && item.date) {
      const itemDate = new Date(item.date);
      if (dateFilterType === 'month') {
        if ((itemDate.getMonth() + 1).toString() !== dateMonth || itemDate.getFullYear().toString() !== dateYear) return false;
      } else if (dateFilterType === 'day') {
        if (item.date.split('T')[0] !== dateDay) return false;
      }
    } else if (dateFilterType !== 'all') {
      return false; // No date but date filter is active
    }
    
    return true;
  });

  // Sort by date descending
  filteredItems.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'todo': return <span className="badge badge-draft">รอดำเนินการ</span>;
      case 'in_progress': return <span className="badge badge-article">กำลังทำ</span>;
      case 'done': 
      case 'published': return <span className="badge badge-published">เสร็จแล้ว</span>;
      default: return null;
    }
  };

  return (
    <div style={{ padding: '0 0.5rem' }}>
      <div style={{ marginBottom: '0.5rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
          <HiChartPie /> รายงานรวม
        </h1>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#334155' }}>
          <HiFunnel /> ตัวกรองข้อมูล
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}><HiUser /> พนักงาน</label>
            <select className="form-input" value={memberFilter} onChange={e => setMemberFilter(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
              <option value="all">ทุกคน</option>
              {members.filter(m => m.status !== 'inactive').map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}><HiTag /> ประเภท</label>
            <select className="form-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
              <option value="all">ทั้งหมด</option>
              <option value="task">งานทั่วไป</option>
              <option value="content">คอนเทนต์</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>สถานะ</label>
            <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
              <option value="all">ทุกสถานะ</option>
              <option value="todo">รอดำเนินการ</option>
              <option value="in_progress">กำลังทำ</option>
              <option value="done">เสร็จแล้ว</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>บริษัท/แบรนด์</label>
            <select className="form-input" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
              <option value="all">ทุกแบรนด์</option>
              <option value="GFS">GFS</option>
              <option value="MHL">MHL</option>
              <option value="CAR">CAR</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}><HiCalendar /> ช่วงเวลา</label>
            <select className="form-input" value={dateFilterType} onChange={e => setDateFilterType(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
              <option value="month">รายเดือน</option>
              <option value="day">รายวัน</option>
              <option value="all">ทุกช่วงเวลา</option>
            </select>
          </div>

          {dateFilterType === 'month' && (
            <div className="form-group" style={{ marginBottom: 0, display: 'flex', gap: '0.5rem' }}>
              <select className="form-input" value={dateMonth} onChange={e => setDateMonth(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem', flex: 1 }}>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m.toString()}>เดือน {m}</option>
                ))}
              </select>
              <select className="form-input" value={dateYear} onChange={e => setDateYear(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem', flex: 1 }}>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
              </select>
            </div>
          )}

          {dateFilterType === 'day' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <DatePicker 
                selected={dateDay ? new Date(dateDay) : null} 
                onChange={(date: Date | null) => setDateDay(date ? format(date, 'yyyy-MM-dd') : '')} 
                dateFormat="dd/MM/yyyy" 
                className="form-input" 
                placeholderText="วว/ดด/ปปปป"
              />
            </div>
          )}

        </div>
      </div>

      {(() => {
        const getBrandStats = (brand: string) => {
          const items = filteredItems.filter(item => item.company === brand);
          const tasks = items.filter(item => item.itemType === 'task');
          const contents = items.filter(item => item.itemType === 'content');
          
          const uniqueMembers = Array.from(new Set(items.map(i => i.memberName)));
          
          const memberBreakdown = uniqueMembers.map(m => {
            const mTasks = tasks.filter(t => t.memberName === m);
            const mContents = contents.filter(c => c.memberName === m);
            return {
              name: m,
              tasksTotal: mTasks.length,
              tasksDone: mTasks.filter(t => t.status === 'done' || t.status === 'เสร็จแล้ว').length,
              contentsTotal: mContents.length,
              contentsDone: mContents.filter(c => c.status === 'published' || c.status === 'done' || c.status === 'เสร็จแล้ว').length
            };
          }).filter(m => m.tasksTotal > 0 || m.contentsTotal > 0)
            .sort((a, b) => {
              const aDone = a.tasksDone + a.contentsDone;
              const bDone = b.tasksDone + b.contentsDone;
              if (bDone !== aDone) return bDone - aDone;
              const aTotal = a.tasksTotal + a.contentsTotal;
              const bTotal = b.tasksTotal + b.contentsTotal;
              return bTotal - aTotal;
            });
            });
          
          const uniquePlatforms = Array.from(new Set(contents.map(i => i.platform).filter(Boolean)));
          const platformBreakdown = uniquePlatforms.map(p => {
            const pContents = contents.filter(c => c.platform === p);
            return {
              name: p,
              total: pContents.length,
              done: pContents.filter(c => c.status === 'published' || c.status === 'done' || c.status === 'เสร็จแล้ว').length
            };
          }).filter(p => p.total > 0).sort((a, b) => (b.done - a.done) || (b.total - a.total));

          return {
            tasksTotal: tasks.length,
            tasksDone: tasks.filter(t => t.status === 'done' || t.status === 'เสร็จแล้ว').length,
            contentsTotal: contents.length,
            contentsDone: contents.filter(c => c.status === 'published' || c.status === 'done' || c.status === 'เสร็จแล้ว').length,
            members: uniqueMembers,
            memberBreakdown,
            platformBreakdown
          };
        };

        const gfsStats = getBrandStats('GFS');
        const mhlStats = getBrandStats('MHL');
        const carStats = getBrandStats('CAR');

        return (
          <div style={{ marginBottom: '1.5rem', backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showBrandStats ? '1rem' : '0' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>ภาพรวมแต่ละแบรนด์</h2>
              <button 
                onClick={() => setShowBrandStats(!showBrandStats)}
                style={{ fontSize: '0.8rem', color: '#3b82f6', background: '#eff6ff', padding: '0.3rem 0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              >
                {showBrandStats ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>
            
            {showBrandStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {[
                  { name: 'GFS', stats: gfsStats, color: '#0ea5e9', bg: '#f0f9ff' },
                  { name: 'MHL', stats: mhlStats, color: '#f59e0b', bg: '#fffbeb' },
                  { name: 'CAR', stats: carStats, color: '#8b5cf6', bg: '#f5f3ff' }
                ].map(brand => (
                  <div key={brand.name} style={{ backgroundColor: brand.bg, borderRadius: '12px', padding: '1rem', border: `1px solid ${brand.color}30` }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: brand.color, margin: '0 0 0.75rem 0' }}>{brand.name}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.03)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.25rem' }}>งานทั่วไป (เสร็จ/รวม)</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#334155' }}>
                          <span style={{ color: '#10b981' }}>{brand.stats.tasksDone}</span> <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>/ {brand.stats.tasksTotal}</span>
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.03)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.25rem' }}>คอนเทนต์ (เสร็จ/รวม)</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#334155' }}>
                          <span style={{ color: '#10b981' }}>{brand.stats.contentsDone}</span> <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>/ {brand.stats.contentsTotal}</span>
                        </div>
                      </div>
                    </div>
                    {brand.stats.platformBreakdown.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1px dashed ${brand.color}40` }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><HiTag size={14} /> รายแพลตฟอร์ม:</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.4rem' }}>
                          {brand.stats.platformBreakdown.map(p => (
                            <div key={p.name} style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(255,255,255,0.7)', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.03)' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '0.15rem' }}>{p.name}</span>
                              <span style={{ fontSize: '0.8rem', color: '#64748b' }}><span style={{ color: '#10b981', fontWeight: 700 }}>{p.done}</span>/{p.total}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {brand.stats.memberBreakdown.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1px dashed ${brand.color}40` }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><HiUser size={14} /> ผลงานรายบุคคล:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {brand.stats.memberBreakdown.map(m => (
                            <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', backgroundColor: 'rgba(255,255,255,0.7)', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.03)' }}>
                              <span style={{ fontWeight: 700, color: brand.color }}>{m.name}</span>
                              <div style={{ display: 'flex', gap: '0.75rem' }}>
                                {m.tasksTotal > 0 && (
                                  <span style={{ color: '#64748b' }}>งาน: <span style={{ color: '#10b981', fontWeight: 700 }}>{m.tasksDone}</span>/{m.tasksTotal}</span>
                                )}
                                {m.contentsTotal > 0 && (
                                  <span style={{ color: '#64748b' }}>คอนเทนต์: <span style={{ color: '#10b981', fontWeight: 700 }}>{m.contentsDone}</span>/{m.contentsTotal}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>ผลลัพธ์การค้นหา</h2>
          <span style={{ backgroundColor: '#eff6ff', color: '#3b82f6', padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700 }}>
            {filteredItems.length} รายการ
          </span>
        </div>

        <div className="desktop-only">
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem', color: '#64748b' }}>วันที่</th>
                <th style={{ padding: '0.75rem', color: '#64748b' }}>ประเภท</th>
                <th style={{ padding: '0.75rem', color: '#64748b' }}>หัวข้อ</th>
                <th style={{ padding: '0.75rem', color: '#64748b', textAlign: 'center' }}>ลิงก์</th>
                <th style={{ padding: '0.75rem', color: '#64748b' }}>ผู้รับผิดชอบ</th>
                <th style={{ padding: '0.75rem', color: '#64748b' }}>แพลตฟอร์ม/ความสำคัญ</th>
                <th style={{ padding: '0.75rem', color: '#64748b' }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? filteredItems.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem' }}>{item.date ? formatDateTime(item.date) : '-'}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: item.itemType === 'task' ? '#f59e0b' : '#3b82f6' }}>
                      {item.itemType === 'task' ? <HiClipboardDocumentList /> : <HiDocumentText />} 
                      {item.itemType === 'task' ? 'งาน' : 'คอนเทนต์'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', fontWeight: 500, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.company ? <span style={{ color: getCompanyColor(item.company), marginRight: '4px' }}>[{item.company}]</span> : null}{item.title}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    {item.link && (
                      <a href={item.link.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.35rem', backgroundColor: '#eff6ff', borderRadius: '6px' }} title="เปิดลิงก์">
                        <HiArrowTopRightOnSquare size={16} />
                      </a>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem' }}>{item.memberName}</td>
                  <td style={{ padding: '0.75rem' }}>{item.itemType === 'content' ? item.platform : item.priority}</td>
                  <td style={{ padding: '0.75rem' }}>{getStatusBadge(item.status)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>ไม่พบข้อมูลตามเงื่อนไขที่เลือก</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredItems.length > 0 ? filteredItems.map((item, i) => (
            <div key={i} style={{ padding: '1rem', border: '1px solid #f1f5f9', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: item.itemType === 'task' ? '#fffbeb' : '#eff6ff', color: item.itemType === 'task' ? '#f59e0b' : '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.itemType === 'task' ? <HiClipboardDocumentList size={16} /> : <HiDocumentText size={16} />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>{item.company ? <span style={{ color: getCompanyColor(item.company), marginRight: '4px' }}>[{item.company}]</span> : null}{item.title}</h4>
                      {item.link && (
                        <a href={item.link.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', padding: '0.35rem', backgroundColor: '#eff6ff', borderRadius: '6px' }} title="เปิดลิงก์">
                          <HiArrowTopRightOnSquare size={14} />
                        </a>
                      )}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{item.memberName}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.75rem' }}>
                <span style={{ color: '#64748b' }}>{item.date ? formatDateTime(item.date) : '-'}</span>
                <span style={{ color: '#64748b' }}>{item.itemType === 'content' ? item.platform : item.priority}</span>
                {getStatusBadge(item.status)}
              </div>
            </div>
          )) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: '12px' }}>ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
          )}
        </div>
      </div>
    </div>
  );
}
