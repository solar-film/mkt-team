'use client';

import { useEffect, useState } from 'react';
import { HiPlus, HiPencilSquare, HiOutlineTrash } from 'react-icons/hi2';
import Modal from '@/components/Modal';
import MemberAvatar from '@/components/MemberAvatar';
import ProgressBar from '@/components/ProgressBar';

interface KPI {
  id: string; name: string; description?: string | null; target: number; current: number;
  unit: string; month: number; year: number; memberId: string;
}

interface TeamMember {
  id: string; name: string; role: string; avatar: string | null; status: string;
  kpis: KPI[];
  tasks?: { id: string; status: string; company?: string; deadline?: string; kpiId?: string | null }[];
  contents?: { id: string; status: string; company?: string; publishDate?: string; kpiId?: string | null }[];
}

export default function KPIsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const currentDate = new Date();
  const [filterMemberId, setFilterMemberId] = useState('');
  const [filterMonth, setFilterMonth] = useState(currentDate.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    // Check global admin status for general display purposes if needed
    const adminStatus = localStorage.getItem('isAdmin') === 'true';
    setIsAdmin(adminStatus);
    
    // Always fetch members for everyone so they can see KPIs
    fetchMembers();
  }, []);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Admin state
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const [kpiDict, setKpiDict] = useState<{id: string, name: string, description: string}[]>([]);
  const [isDictModalOpen, setIsDictModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '', description: '', target: '', current: '0', unit: '', month: (currentDate.getMonth() + 1).toString(), year: currentDate.getFullYear().toString(), memberId: ''
  });

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (data && data.members) {
          const enrichedMembers = data.members.map((m: any) => ({
            ...m,
            tasks: data.tasks?.filter((t: any) => t.memberId === m.id || t.memberId?.includes(m.id)) || [],
            contents: data.contents?.filter((c: any) => c.memberId === m.id || c.memberId?.includes(m.id)) || [],
            kpis: data.kpis?.filter((k: any) => k.memberId === m.id) || []
          }));
          setMembers(enrichedMembers);
        }
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDict = async () => {
    try {
      const res = await fetch('/api/kpi-dict?t=' + Date.now());
      if (res.ok) setKpiDict(await res.json());
    } catch (error) {
      console.error('Failed to fetch KPI dictionary:', error);
    }
  };

  const addDictItem = () => {
    setKpiDict([...kpiDict, { id: Date.now().toString(), name: '', description: '' }]);
  };

  const handleSaveDict = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/kpi-dict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kpiDict)
      });
      setIsDictModalOpen(false);
      fetchDict();
    } catch (error) {
      console.error('Failed to save dictionary:', error);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchDict();
  }, []);

  const handleAdminToggle = () => {
    if (isAdminMode) {
      setIsAdminMode(false);
    } else {
      setIsPasswordModalOpen(true);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '3107') {
      setIsAdminMode(true);
      setIsPasswordModalOpen(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError('รหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleEdit = (kpi: KPI, memberId: string) => {
    setFormData({
      name: kpi.name,
      target: kpi.target.toString(),
      current: kpi.current.toString(),
      unit: kpi.unit,
      month: kpi.month.toString(),
      year: kpi.year.toString(),
      memberId: memberId
    });
    setEditId(kpi.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (kpiId: string) => {
    if (!confirm('คุณต้องการลบเป้าหมาย KPI นี้ใช่หรือไม่?')) return;
    try {
      await fetch(`/api/kpis?id=${kpiId}`, { method: 'DELETE' });
      fetchMembers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        ...formData,
        target: parseFloat(formData.target),
        current: parseFloat(formData.current),
        month: parseInt(formData.month, 10),
        year: parseInt(formData.year, 10)
      };
      
      if (isEditing && editId) {
        await fetch('/api/kpis', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...body })
        });
      } else {
        await fetch('/api/kpis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }
      
      setIsModalOpen(false);
      setIsEditing(false);
      setEditId(null);
      setFormData({ name: '', description: '', target: '', current: '0', unit: '', month: (currentDate.getMonth() + 1).toString(), year: currentDate.getFullYear().toString(), memberId: '' });
      fetchMembers();
    } catch (err) {
      console.error(err);
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'success';
    if (percent >= 80) return 'primary';
    if (percent >= 50) return 'warning';
    return 'danger';
  };

  const filteredMembers = (filterMemberId 
    ? members.filter(m => m.id === filterMemberId) 
    : members).filter(member => member.kpis?.some(k => k.month === filterMonth && k.year === filterYear));
  
  if (loading) return <div className="loading-container"><div className="loading-spinner"></div></div>;

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '0.5rem', alignItems: 'center' }}>
        <div className="page-header-content">
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>เป้าหมาย KPI</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className={`btn ${isAdminMode ? 'btn-secondary' : 'btn-outline'}`} 
            onClick={handleAdminToggle}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: isAdminMode ? '#e2e8f0' : 'transparent', border: '1px solid #e2e8f0' }}
          >
            {isAdminMode ? 'ปิดโหมด Admin' : 'โหมด Admin'}
          </button>
          {isAdminMode && (
            <button className="btn btn-primary" onClick={() => {
              setIsEditing(false);
              setEditId(null);
              setFormData({ name: '', target: '', current: '0', unit: '', month: (currentDate.getMonth() + 1).toString(), year: currentDate.getFullYear().toString(), memberId: '' });
              setIsModalOpen(true);
            }}>
              <HiPlus /> ตั้งเป้าหมาย
            </button>
          )}
        </div>
      </div>

      <div className="filter-bar" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>เดือน:</label>
            <select 
              className="form-select" 
              value={filterMonth}
              onChange={(e) => setFilterMonth(parseInt(e.target.value))}
            >
              {thaiMonths.map((m, i) => (
                <option key={i} value={i+1}>{m}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>ปี:</label>
            <select 
              className="form-select" 
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value))}
            >
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
              <option value={2028}>2028</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>พนักงาน:</label>
            <select 
              className="form-select" 
              style={{ width: '200px' }}
              value={filterMemberId}
              onChange={(e) => setFilterMemberId(e.target.value)}
            >
              <option value="">-- ทั้งหมด --</option>
              {members.filter(m => m.status !== 'inactive' && m.role !== 'Admin').map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredMembers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-secondary)', gridColumn: '1 / -1' }}>
          <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>ไม่มีเป้าหมาย KPI ในเดือนนี้</p>
          <p style={{ fontSize: '0.9rem' }}>ทีมยังไม่มีการตั้งเป้าหมายในเดือนที่เลือก</p>
        </div>
      ) : (
        <div className="kpi-grid">
          {filteredMembers.map(member => {
            const monthKpis = member.kpis.filter(k => k.month === filterMonth && k.year === filterYear);
            let avgKpi = 0;
            if (monthKpis.length > 0) {
              const totalPercent = monthKpis.reduce((sum, k) => {
                const linkedTasksDone = member.tasks?.filter(t => t.kpiId === k.id && (t.status === 'done' || t.status === 'เสร็จแล้ว')).length || 0;
                const linkedContentsDone = member.contents?.filter(c => c.kpiId === k.id && (c.status === 'done' || c.status === 'เสร็จแล้ว')).length || 0;
                const autoCurrent = linkedTasksDone + linkedContentsDone;
                const displayCurrent = Math.max(Number(k.current) || 0, autoCurrent);
                const percent = k.target === 0 ? (displayCurrent > 0 ? 100 : 0) : Math.min((displayCurrent / k.target) * 100, 100);
                return sum + percent;
              }, 0);
              avgKpi = Math.round(totalPercent / monthKpis.length);
            }
            return { ...member, avgKpi, monthKpis };
          }).sort((a, b) => b.avgKpi - a.avgKpi).map(member => {
            const { avgKpi, monthKpis } = member;
            const color = avgKpi >= 100 ? '#10b981' : avgKpi >= 80 ? '#3b82f6' : avgKpi >= 50 ? '#f59e0b' : '#ef4444';

            return (
            <div key={member.id} className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <MemberAvatar name={member.name} />
                <div>
                  <h3 style={{ fontSize: '1rem', margin: 0 }}>{member.name}</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{member.role}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: color }}>{avgKpi}%</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ภาพรวมสำเร็จ</div>
              </div>
            </div>
            <div className="card-body">
              {(() => {
                const getStats = (company: string) => {
                  const cTasks = (member.tasks || []).filter(t => {
                    if (t.company !== company) return false;
                    if (!t.deadline) return false;
                    const d = new Date(t.deadline);
                    return (d.getMonth() + 1) === filterMonth && d.getFullYear() === filterYear;
                  });
                  const cContents = (member.contents || []).filter(c => {
                    if (c.company !== company) return false;
                    if (!c.publishDate) return false;
                    const d = new Date(c.publishDate);
                    return (d.getMonth() + 1) === filterMonth && d.getFullYear() === filterYear;
                  });
                  return { t: cTasks.length, c: cContents.length };
                };
                const gfs = getStats('GFS');
                const mhl = getStats('MHL');
                const car = getStats('CAR');
                const hasStats = gfs.t > 0 || gfs.c > 0 || mhl.t > 0 || mhl.c > 0 || car.t > 0 || car.c > 0;

                const monthKpis = member.kpis.filter(k => k.month === filterMonth && k.year === filterYear).sort((a, b) => {
                  if (a.name === 'งานทั่วไป') return -1;
                  if (b.name === 'งานทั่วไป') return 1;
                  return a.name.localeCompare(b.name);
                });
                return (
                  <>
                    {hasStats && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                        {[
                          { name: 'GFS', stats: gfs, color: '#0ea5e9', bg: '#f0f9ff' },
                          { name: 'MHL', stats: mhl, color: '#f59e0b', bg: '#fffbeb' },
                          { name: 'CAR', stats: car, color: '#8b5cf6', bg: '#f5f3ff' }
                        ].map(comp => comp.stats.t > 0 || comp.stats.c > 0 ? (
                          <div key={comp.name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: comp.bg, padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', border: `1px solid ${comp.color}30` }}>
                            <span style={{ fontWeight: 800, color: comp.color }}>{comp.name}:</span>
                            {comp.stats.t > 0 && <span style={{ color: '#475569', fontWeight: 500 }}>{comp.stats.t} งาน</span>}
                            {comp.stats.t > 0 && comp.stats.c > 0 && <span style={{ color: '#cbd5e1' }}>|</span>}
                            {comp.stats.c > 0 && <span style={{ color: '#475569', fontWeight: 500 }}>{comp.stats.c} คอนเทนต์</span>}
                          </div>
                        ) : null)}
                      </div>
                    )}
                    {monthKpis.length > 0 ? (
                      monthKpis.map(kpi => {
                        const linkedTasksDone = member.tasks?.filter(t => t.kpiId === kpi.id && (t.status === 'done' || t.status === 'เสร็จแล้ว')).length || 0;
                        const linkedContentsDone = member.contents?.filter(c => c.kpiId === kpi.id && (c.status === 'done' || c.status === 'เสร็จแล้ว')).length || 0;
                        const autoCurrent = linkedTasksDone + linkedContentsDone;
                        const displayCurrent = Math.max(Number(kpi.current) || 0, autoCurrent);
                        const percent = kpi.target === 0 ? (displayCurrent > 0 ? 100 : 0) : Math.min((displayCurrent / kpi.target) * 100, 100);
                        const color = getProgressColor(percent);
                    
                    return (
                      <div key={kpi.id} className="kpi-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div className="kpi-meta" style={{ marginBottom: 0, width: '100%' }}>
                            <span style={{ fontWeight: 500 }}>{kpi.name}</span>
                            <span>{displayCurrent} / {kpi.target} {kpi.unit}</span>
                          </div>
                          {isAdminMode && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, marginLeft: '1rem' }}>
                              <button onClick={() => handleEdit(kpi, member.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.2rem' }}>
                                <HiPencilSquare size={16} />
                              </button>
                              <button onClick={() => handleDelete(kpi.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}>
                                <HiOutlineTrash size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                        <ProgressBar value={percent} color={color} />
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                    ไม่มีเป้าหมาย KPI ในเดือนนี้
                  </div>
                )}
              </>
            );
              })()}
            </div>
          </div>
          )})}
        </div>
      )}

      {/* KPI Explanation Card */}
      <div className="card" style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            💡 ความหมายของหัวข้อ KPI
          </h3>
          {isAdminMode && (
            <button 
              onClick={() => setIsDictModalOpen(true)}
              style={{ backgroundColor: 'white', color: '#4f46e5', border: '1px solid #e2e8f0', padding: '0.4rem 0.75rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}
            >
              <HiPencilSquare size={16} /> แก้ไขคำอธิบาย
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {kpiDict.map(item => {
            const isImportant = item.name.startsWith('*');
            return (
              <div key={item.id} style={{ 
                padding: '1rem', 
                backgroundColor: isImportant ? '#fffbeb' : 'white', 
                borderRadius: '8px',
                border: isImportant ? '1px solid #fde68a' : '1px solid #e2e8f0',
                boxShadow: isImportant ? '0 2px 4px rgba(245, 158, 11, 0.1)' : '0 1px 2px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isImportant ? '#b45309' : '#334155', marginBottom: '0.5rem' }}>
                  {isImportant && <span style={{ marginRight: '4px' }}>⭐️</span>}
                  {item.name.replace(/^\*/, '')}
                </div>
                <div style={{ fontSize: '0.75rem', color: isImportant ? '#78350f' : '#64748b', lineHeight: 1.6 }}>{item.description}</div>
              </div>
            );
          })}
          {kpiDict.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', gridColumn: '1 / -1', textAlign: 'center' }}>ยังไม่มีคำอธิบาย</div>
          )}
        </div>
      </div>

      {/* Dictionary Edit Modal */}
      <Modal isOpen={isDictModalOpen} onClose={() => { setIsDictModalOpen(false); fetchDict(); }} title="แก้ไขคำอธิบายหัวข้อ KPI">
        <form onSubmit={handleSaveDict}>
          <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1rem' }}>
            {kpiDict.map((item, index) => (
              <div key={item.id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1rem', position: 'relative' }}>
                <button type="button" onClick={() => setKpiDict(kpiDict.filter((_, i) => i !== index))} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                  <HiOutlineTrash size={18} />
                </button>
                <div className="form-group">
                  <label className="form-label">ชื่อหัวข้อ</label>
                  <input type="text" className="form-input" required value={item.name} onChange={e => {
                    const newDict = [...kpiDict];
                    newDict[index].name = e.target.value;
                    setKpiDict(newDict);
                  }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">คำอธิบาย</label>
                  <textarea className="form-input" rows={2} required value={item.description} onChange={e => {
                    const newDict = [...kpiDict];
                    newDict[index].description = e.target.value;
                    setKpiDict(newDict);
                  }}></textarea>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addDictItem} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <HiPlus size={18} /> เพิ่มหัวข้อใหม่
          </button>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setIsDictModalOpen(false); fetchDict(); }}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">บันทึก</button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit KPI Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? "แก้ไขเป้าหมาย KPI" : "ตั้งเป้าหมาย KPI"}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">ชื่อ KPI *</label>
            <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="เช่น ยอดผู้ติดตาม, บทความที่เขียน" />
          </div>
          <div className="form-group">
            <label className="form-label">พนักงาน *</label>
            <select className="form-select" required value={formData.memberId} onChange={e => setFormData({...formData, memberId: e.target.value})}>
              <option value="">-- เลือกผู้รับผิดชอบ --</option>
              {members.filter(m => m.status !== 'inactive' && m.role !== 'Admin').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">เป้าหมาย *</label>
              <input type="number" step="0.01" className="form-input" required value={formData.target} onChange={e => setFormData({...formData, target: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">หน่วย *</label>
              <input type="text" className="form-input" required value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} placeholder="เช่น ครั้ง, คน, %" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">เดือน *</label>
              <select className="form-select" required value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})}>
                {thaiMonths.map((m, i) => (
                  <option key={i} value={i+1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">ปี *</label>
              <input type="number" className="form-input" required value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">บันทึก</button>
          </div>
        </form>
      </Modal>


      {/* Password Modal */}
      <Modal isOpen={isPasswordModalOpen} onClose={() => { setIsPasswordModalOpen(false); setPasswordInput(''); setPasswordError(''); }} title="กรุณาใส่รหัสผ่าน (Password)">
        <form onSubmit={handlePasswordSubmit}>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <input 
              type="password" 
              className="form-input" 
              autoFocus
              value={passwordInput} 
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }} 
              placeholder="รหัสผ่านสำหรับผู้ดูแลระบบ" 
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
            />
            {passwordError && <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{passwordError}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setIsPasswordModalOpen(false); setPasswordInput(''); setPasswordError(''); }}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">ตกลง</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
