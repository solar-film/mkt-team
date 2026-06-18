'use client';

import { useEffect, useState } from 'react';
import { HiPlus, HiPencilSquare, HiLockClosed } from 'react-icons/hi2';
import Modal from '@/components/Modal';
import MemberAvatar from '@/components/MemberAvatar';
import ProgressBar from '@/components/ProgressBar';

interface KPI {
  id: string; name: string; target: number; current: number;
  unit: string; month: number; year: number; memberId: string;
}

interface TeamMember {
  id: string; name: string; role: string; avatar: string | null; status: string;
  kpis: KPI[];
  tasks?: { id: string; status: string; company?: string; deadline?: string }[];
  contents?: { id: string; status: string; company?: string; publishDate?: string }[];
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
    // Check admin status
    const adminStatus = localStorage.getItem('isAdmin') === 'true';
    setIsAdmin(adminStatus);
    
    if (adminStatus) {
      fetchMembers();
    } else {
      setLoading(false);
    }
  }, []);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '', target: '', current: '0', unit: '', month: (currentDate.getMonth() + 1).toString(), year: currentDate.getFullYear().toString(), memberId: ''
  });

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', target: '', current: '0', unit: '', month: filterMonth.toString(), year: filterYear.toString(), memberId: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (kpi: KPI) => {
    setEditingId(kpi.id);
    setFormData({
      name: kpi.name,
      target: kpi.target.toString(),
      current: kpi.current.toString(),
      unit: kpi.unit,
      month: kpi.month.toString(),
      year: kpi.year.toString(),
      memberId: kpi.memberId
    });
    setIsModalOpen(true);
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members?includeRelations=true');
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        id: editingId,
        ...formData,
        target: parseFloat(formData.target),
        current: parseFloat(formData.current),
        month: parseInt(formData.month, 10),
        year: parseInt(formData.year, 10)
      };
      await fetch('/api/kpis', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setIsModalOpen(false);
      setFormData({ name: '', target: '', current: '0', unit: '', month: filterMonth.toString(), year: filterYear.toString(), memberId: '' });
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
    : members).filter(member => {
      const monthKpis = member.kpis?.filter(k => k.month === filterMonth && k.year === filterYear) || [];
      return monthKpis.length > 0;
    });
  if (isAdmin === null) return <div className="loading-container"><div className="loading-spinner"></div></div>;

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
        {isAdmin && (
          <button className="btn btn-primary" onClick={openAddModal}>
            <HiPlus /> ตั้งเป้าหมาย
          </button>
        )}
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
              {members.filter(m => m.status !== 'inactive').map(m => (
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
                const target = Number(k.target) || 1;
                const percent = k.target === 0 ? (k.current > 0 ? 100 : 0) : Math.min((k.current / target) * 100, 100);
                return sum + percent;
              }, 0);
              avgKpi = Math.round(totalPercent / monthKpis.length);
            }
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

                const monthKpis = member.kpis.filter(k => k.month === filterMonth && k.year === filterYear);
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
                    const target = Number(kpi.target) || 1;
                    const percent = kpi.target === 0 ? (kpi.current > 0 ? 100 : 0) : Math.min((kpi.current / kpi.target) * 100, 100);
                    const color = getProgressColor(percent);
                    
                    return (
                      <div key={kpi.id} className="kpi-item">
                        <div className="kpi-meta">
                          <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {kpi.name}
                            {isAdmin && (
                              <button onClick={() => openEditModal(kpi)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                <HiPencilSquare size={14} />
                              </button>
                            )}
                          </span>
                          <span>{kpi.current} / {kpi.target} {kpi.unit}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ flex: 1 }}>
                            <ProgressBar value={percent} color={color} />
                          </div>
                        </div>
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

      {/* Add/Edit KPI Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "แก้ไขเป้าหมาย KPI" : "ตั้งเป้าหมาย KPI"}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">ชื่อ KPI *</label>
            <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="เช่น ยอดผู้ติดตาม, บทความที่เขียน" />
          </div>
          <div className="form-group">
            <label className="form-label">พนักงาน *</label>
            <select className="form-select" required value={formData.memberId} onChange={e => setFormData({...formData, memberId: e.target.value})}>
              <option value="">-- เลือกพนักงาน --</option>
              {members.filter(m => m.status !== 'inactive').map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
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


    </div>
  );
}
