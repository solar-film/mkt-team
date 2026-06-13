'use client';

import { useEffect, useState } from 'react';
import { HiPlus, HiBriefcase, HiCheckCircle, HiDocumentText, HiOutlineTrash, HiPencilSquare } from 'react-icons/hi2';
import Modal from '@/components/Modal';
import ConfirmModal from '@/components/ConfirmModal';
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

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', role: '' });
  const [showInactive, setShowInactive] = useState(false);

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
      if (editingId) {
        await fetch('/api/members', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, id: editingId })
        });
      } else {
        await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      setIsModalOpen(false);
      setFormData({ name: '', role: '' });
      setEditingId(null);
      fetchMembers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (member: TeamMember) => {
    setFormData({ name: member.name, role: member.role });
    setEditingId(member.id);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setMemberToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;
    try {
      await fetch('/api/members', { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberToDelete, status: 'inactive' })
      });
      setMemberToDelete(null);
      setIsConfirmOpen(false);
      fetchMembers();
    } catch (err) {
      console.error(err);
    }
  };

  const openAddModal = () => {
    setFormData({ name: '', role: '' });
    setEditingId(null);
    setIsModalOpen(true);
  };

  if (loading) return <div className="loading-container"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1>ทีมงาน</h1>
          <p>สมาชิกในทีมการตลาดและคอนเท้น</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowInactive(!showInactive)}>
            {showInactive ? 'ซ่อนพนักงานที่ออกแล้ว' : 'ดูพนักงานที่ออกแล้ว'}
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <HiPlus /> เพิ่มสมาชิก
          </button>
        </div>
      </div>

      <div className="team-grid">
        {members.filter(m => showInactive ? true : m.status !== 'inactive').map(member => {
          const completedTasks = member.tasks.filter(t => t.status === 'done').length;
          const totalContent = member.contents.length;
          const totalTasks = completedTasks + totalContent;
          
          const kpis = member.kpis;
          const avgKPI = kpis.length > 0 
            ? kpis.reduce((sum, k) => {
                const target = k.target > 0 ? k.target : 1;
                return sum + Math.min((k.current / target) * 100, 100);
              }, 0) / kpis.length 
            : 0;
          const kpisMet = kpis.filter(k => k.current >= k.target).length;

          // Get latest 3 tasks
          const recentTasks = [...member.tasks]
            .sort((a, b) => new Date(b.deadline || 0).getTime() - new Date(a.deadline || 0).getTime())
            .slice(0, 3);

          return (
            <div key={member.id} className="card member-card">
              <div className="member-card-header">
                <MemberAvatar name={member.name} size="lg" />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 0.25rem 0' }}>{member.name}</h3>
                  <span className="badge badge-draft">{member.role}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <button className="btn btn-icon btn-sm" onClick={() => handleEdit(member)}>
                    <HiPencilSquare />
                  </button>
                  {member.status !== 'inactive' && (
                    <button className="btn btn-icon btn-sm" style={{ color: 'var(--color-text-secondary)' }} onClick={() => handleDeleteClick(member.id)} title="ซ่อนพนักงาน">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="member-stats-mini" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem', backgroundColor: 'var(--color-surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div className="stat-mini">
                  <div className="stat-mini-value" style={{ color: 'var(--color-primary)' }}>{totalTasks}</div>
                  <div className="stat-mini-label"><HiBriefcase style={{display:'inline'}}/> งานรวม</div>
                </div>
                <div className="stat-mini">
                  <div className="stat-mini-value" style={{ color: 'var(--color-success)' }}>{completedTasks}</div>
                  <div className="stat-mini-label"><HiCheckCircle style={{display:'inline'}}/> งานเสร็จ</div>
                </div>
                <div className="stat-mini">
                  <div className="stat-mini-value" style={{ color: 'var(--color-secondary)' }}>{totalContent}</div>
                  <div className="stat-mini-label"><HiDocumentText style={{display:'inline'}}/> คอนเท้น</div>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  <span>ภาพรวม KPI</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{kpisMet}/{kpis.length} สำเร็จ</span>
                </div>
                <ProgressBar value={avgKPI || 0} />
              </div>

              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--color-text-secondary)' }}>งานล่าสุด</h4>
                {recentTasks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {recentTasks.map(task => (
                      <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', padding: '0.5rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{task.title}</span>
                        {task.status === 'done' && <span className="badge badge-published">เสร็จ</span>}
                        {task.status === 'in_progress' && <span className="badge badge-article">กำลังทำ</span>}
                        {task.status === 'todo' && <span className="badge badge-draft">รอดำเนินการ</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>ไม่มีงานในระบบ</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "แก้ไขข้อมูลสมาชิก" : "เพิ่มสมาชิกใหม่"}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">ชื่อ - นามสกุล *</label>
            <input 
              type="text" 
              className="form-input" 
              required 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="เช่น สมชาย ใจดี"
            />
          </div>
          <div className="form-group">
            <label className="form-label">ตำแหน่ง *</label>
            <input 
              type="text" 
              className="form-input" 
              required 
              value={formData.role}
              onChange={e => setFormData({...formData, role: e.target.value})}
              placeholder="เช่น Content Creator"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">บันทึก</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="ยืนยันการซ่อนพนักงาน"
        message="คุณต้องการซ่อนพนักงานคนนี้จากระบบใช่หรือไม่? (ข้อมูลงานและผลงานเก่าๆ จะยังคงถูกเก็บไว้ แต่ชื่อจะไม่แสดงในช่องเลือกพนักงานอีก)"
      />
    </div>
  );
}
