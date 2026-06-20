'use client';

import { useState, useEffect } from 'react';
import { HiPlus, HiPencil, HiTrash, HiLightBulb, HiXMark, HiUser, HiBriefcase, HiSparkles, HiChatBubbleLeftEllipsis } from 'react-icons/hi2';
import Modal from '@/components/Modal';
import MemberAvatar from '@/components/MemberAvatar';

interface IdeaNote {
  id: string;
  title: string;
  description: string | null;
  memberId: string | null;
  recommendedFor: string | null;
  company: string | null;
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
  const [filterCompany, setFilterCompany] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    memberId: '',
    recommendedFor: '',
    company: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ideasRes, membersRes] = await Promise.all([
        fetch('/api/ideas', { cache: 'no-store' }),
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
  }, []);

  const filteredIdeas = ideas.filter(idea => {
    const matchCompany = filterCompany ? idea.company === filterCompany : true;
    const searchLower = searchQuery.toLowerCase();
    const matchSearch = searchQuery 
      ? (idea.title.toLowerCase().includes(searchLower) || 
         (idea.description && idea.description.toLowerCase().includes(searchLower)) ||
         (idea.recommendedFor && idea.recommendedFor.toLowerCase().includes(searchLower)) ||
         (idea.memberId && getMemberName(idea.memberId).toLowerCase().includes(searchLower)))
      : true;
    return matchCompany && matchSearch;
  });

  const openAddModal = () => {
    setFormData({ title: '', description: '', memberId: '', recommendedFor: '', company: '' });
    setIsEditing(false);
    setEditingId('');
    setIsModalOpen(true);
  };

  const openEditModal = (idea: IdeaNote) => {
    let displayName = idea.memberId || '';
    const m = members.find(member => member.id === idea.memberId);
    if (m) displayName = m.name;

    setFormData({
      title: idea.title,
      description: idea.description || '',
      memberId: displayName,
      recommendedFor: idea.recommendedFor || '',
      company: idea.company || ''
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
    return m ? m.name : id;
  };

  const colors = ['#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#ffe4e6'];
  const accentColors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

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

      <div className="filter-bar" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label className="form-label" style={{ marginBottom: 0 }}>ดูไอเดียของบริษัท:</label>
          <select 
            className="form-select" 
            style={{ width: '150px' }}
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
          >
            <option value="">-- ทั้งหมด --</option>
            <option value="GFS">GFS</option>
            <option value="MHL">MHL</option>
            <option value="CAR">CAR</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="ค้นหาไอเดีย..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner"></div></div>
      ) : filteredIdeas.length === 0 ? (
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
          {filteredIdeas.map((idea, index) => (
            <div 
              key={idea.id} 
              style={{ 
                backgroundColor: '#ffffff', 
                borderRadius: '16px', 
                padding: '1.5rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid #f1f5f9',
                borderTop: `4px solid ${accentColors[index % accentColors.length]}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <HiLightBulb style={{ color: accentColors[index % accentColors.length], flexShrink: 0, marginTop: '0.2rem', fontSize: '1.25rem' }} />
                  {idea.title}
                </h3>
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, opacity: 0.7, transition: 'opacity 0.2s' }} 
                     onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                     onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}>
                  <button onClick={() => openEditModal(idea)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '0.35rem', borderRadius: '8px', color: '#64748b', transition: 'all 0.2s' }} onMouseEnter={e => {e.currentTarget.style.background='#f1f5f9'; e.currentTarget.style.color='#3b82f6'}} onMouseLeave={e => {e.currentTarget.style.background='#f8fafc'; e.currentTarget.style.color='#64748b'}} title="แก้ไข">
                    <HiPencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(idea.id)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '0.35rem', borderRadius: '8px', color: '#64748b', transition: 'all 0.2s' }} onMouseEnter={e => {e.currentTarget.style.background='#fee2e2'; e.currentTarget.style.borderColor='#fca5a5'; e.currentTarget.style.color='#ef4444'}} onMouseLeave={e => {e.currentTarget.style.background='#f8fafc'; e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#64748b'}} title="ลบ">
                    <HiTrash size={16} />
                  </button>
                </div>
              </div>
              
              <div style={{ fontSize: '0.95rem', color: '#475569', whiteSpace: 'pre-wrap', flexGrow: 1, lineHeight: 1.6, backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                {idea.description ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <HiChatBubbleLeftEllipsis style={{ color: '#94a3b8', flexShrink: 0, marginTop: '0.2rem' }} size={16} />
                    <span>{idea.description}</span>
                  </div>
                ) : (
                  <span style={{ color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><HiChatBubbleLeftEllipsis size={16} /> ไม่มีรายละเอียดเพิ่มเติม</span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {idea.recommendedFor && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: `linear-gradient(135deg, ${accentColors[index % accentColors.length]}15, ${accentColors[index % accentColors.length]}30)`, color: accentColors[index % accentColors.length], padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${accentColors[index % accentColors.length]}40` }}>
                      <HiSparkles size={14} /> แนะนำให้ทำ: {idea.recommendedFor}
                    </div>
                  )}
                  {idea.company && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#ffffff', color: '#334155', padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <HiBriefcase size={14} color="#64748b" /> บริษัท: {idea.company}
                    </div>
                  )}
                  {idea.memberId && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#f1f5f9', color: '#475569', padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, border: '1px solid #e2e8f0' }}>
                      <HiUser size={14} /> ไอเดียโดย: {getMemberName(idea.memberId)}
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingTop: '1rem', borderTop: '1px dashed #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.5px' }}>
                  บันทึกเมื่อ {formatDate(idea.createdAt)}
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
            <input 
              type="text"
              list="idea-members"
              className="form-input" 
              value={formData.memberId} 
              onChange={e => setFormData({...formData, memberId: e.target.value})}
              placeholder="-- ระบุชื่อ หรือเลือกจากรายชื่อ --"
            />
            <datalist id="idea-members">
              {members.filter(m => m.status !== 'inactive').sort((a, b) => {
                const order = ['แต้ว', 'เพลง', 'นน'];
                const idxA = order.indexOf(a.name);
                const idxB = order.indexOf(b.name);
                if (idxA === -1 && idxB === -1) return a.name.localeCompare(b.name);
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
              }).map(m => (
                <option key={m.id} value={m.name} />
              ))}
            </datalist>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">แนะนำสำหรับ (ใครทำ)</label>
              <input 
                type="text"
                list="idea-members"
                className="form-input" 
                value={formData.recommendedFor} 
                onChange={e => setFormData({...formData, recommendedFor: e.target.value})}
                placeholder="เช่น แต้ว, เพลง, นน..."
              />
            </div>
            
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">บริษัท (ตัวเลือก)</label>
              <select 
                className="form-select" 
                value={formData.company} 
                onChange={e => setFormData({...formData, company: e.target.value})}
              >
                <option value="">-- ไม่ระบุ --</option>
                <option value="GFS">GFS</option>
                <option value="MHL">MHL</option>
                <option value="CAR">CAR</option>
              </select>
            </div>
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
