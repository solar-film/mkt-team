'use client';

import { useState, useEffect } from 'react';
import { HiPlus, HiPencil, HiTrash, HiLightBulb, HiXMark } from 'react-icons/hi2';
import Modal from '@/components/Modal';
import MemberAvatar from '@/components/MemberAvatar';

interface IdeaNote {
  id: string;
  title: string;
  description: string | null;
  memberId: string | null;
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  status: string;
}

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<IdeaNote[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [filterMemberId, setFilterMemberId] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    memberId: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ideasRes, membersRes] = await Promise.all([
        fetch('/api/ideas' + (filterMemberId ? `?memberId=${filterMemberId}` : ''), { cache: 'no-store' }),
        fetch('/api/members', { cache: 'no-store' })
      ]);
      
      if (ideasRes.ok) {
        const ideasData = await ideasRes.json();
        setIdeas(ideasData);
      }
      
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterMemberId]);

  const openAddModal = () => {
    setFormData({ title: '', description: '', memberId: '' });
    setIsEditing(false);
    setEditingId('');
    setIsModalOpen(true);
  };

  const openEditModal = (idea: IdeaNote) => {
    setFormData({
      title: idea.title,
      description: idea.description || '',
      memberId: idea.memberId || ''
    });
    setIsEditing(true);
    setEditingId(idea.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await fetch('/api/ideas', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...formData })
        });
      } else {
        await fetch('/api/ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving idea:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบไอเดียนี้?')) return;
    try {
      await fetch(`/api/ideas?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting idea:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getMemberName = (id: string | null) => {
    if (!id) return 'ไม่ระบุ';
    const m = members.find(m => m.id === id);
    return m ? m.name : 'ไม่ระบุ';
  };

  const colors = ['#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#ffe4e6'];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div className="page-header-content">
          <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HiLightBulb style={{ color: '#f59e0b' }} /> โน๊ตไอเดียงาน
          </h1>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <HiPlus /> เพิ่มไอเดีย
        </button>
      </div>

      <div className="filter-bar" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <label className="form-label" style={{ marginBottom: 0 }}>ดูไอเดียของ:</label>
        <select 
          className="form-select" 
          style={{ width: '200px' }}
          value={filterMemberId}
          onChange={(e) => setFilterMemberId(e.target.value)}
        >
          <option value="">-- ทั้งหมด --</option>
          {members.filter(m => m.status !== 'inactive').sort((a, b) => {
            const order = ['แต้ว', 'เพลง', 'นน'];
            const idxA = order.indexOf(a.name);
            const idxB = order.indexOf(b.name);
            if (idxA === -1 && idxB === -1) return a.name.localeCompare(b.name);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          }).map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner"></div></div>
      ) : ideas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-secondary)' }}>
          <HiLightBulb style={{ fontSize: '4rem', color: '#cbd5e1', marginBottom: '1rem' }} />
          <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>ยังไม่มีไอเดียถูกบันทึกไว้</p>
          <p style={{ fontSize: '0.9rem' }}>คลิกปุ่ม &quot;เพิ่มไอเดีย&quot; ด้านบนเพื่อบันทึกไอเดียแรกของคุณ</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '1.5rem',
          alignItems: 'start'
        }}>
          {ideas.map((idea, index) => (
            <div 
              key={idea.id} 
              style={{ 
                backgroundColor: colors[index % colors.length], 
                borderRadius: '12px', 
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                transition: 'transform 0.2s, box-shadow 0.2s',
                border: '1px solid rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.4 }}>
                  {idea.title}
                </h3>
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  <button onClick={() => openEditModal(idea)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#64748b' }} title="แก้ไข">
                    <HiPencil size={18} />
                  </button>
                  <button onClick={() => handleDelete(idea.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#ef4444' }} title="ลบ">
                    <HiTrash size={18} />
                  </button>
                </div>
              </div>
              
              <div style={{ fontSize: '0.95rem', color: '#334155', whiteSpace: 'pre-wrap', flexGrow: 1, lineHeight: 1.6 }}>
                {idea.description || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>ไม่มีรายละเอียด</span>}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MemberAvatar name={getMemberName(idea.memberId)} size="sm" />
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>{getMemberName(idea.memberId)}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {formatDate(idea.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'แก้ไขไอเดีย' : 'เพิ่มไอเดียใหม่'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">หัวข้อไอเดีย *</label>
            <input 
              type="text" 
              className="form-input" 
              required 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="เช่น ทำคลิปรีวิวสินค้าใหม่..."
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">รายละเอียด / โน๊ตเพิ่มเติม</label>
            <textarea 
              className="form-textarea" 
              rows={6}
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="จดรายละเอียดไอเดีย แหล่งอ้างอิง หรือสิ่งที่ต้องทำ..."
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">เจ้าของไอเดีย (ตัวเลือก)</label>
            <select 
              className="form-select" 
              value={formData.memberId} 
              onChange={e => setFormData({...formData, memberId: e.target.value})}
            >
              <option value="">-- ไม่ระบุ (ไอเดียส่วนรวม) --</option>
              {members.filter(m => m.status !== 'inactive').sort((a, b) => {
                const order = ['แต้ว', 'เพลง', 'นน'];
                const idxA = order.indexOf(a.name);
                const idxB = order.indexOf(b.name);
                if (idxA === -1 && idxB === -1) return a.name.localeCompare(b.name);
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
              }).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">{isEditing ? 'บันทึกการแก้ไข' : 'บันทึกไอเดีย'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
