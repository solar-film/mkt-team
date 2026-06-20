'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { HiPlus, HiFunnel, HiMagnifyingGlass } from 'react-icons/hi2';
import IdeaCard from '@/components/ideas/IdeaCard';
import IdeaDetailPane from '@/components/ideas/IdeaDetailPane';
import Modal from '@/components/Modal';

export default function IdeasPage() {
  const { currentUserId, isLoading: authLoading } = useAuth();
  const [ideas, setIdeas] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id) setSelectedIdeaId(id);
    }
  }, []);

  const [filterStatus, setFilterStatus] = useState('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link: '',
    company: '',
    priority: 'ปกติ',
    memberId: ''
  });

  const fetchData = async () => {
    try {
      const [ideasRes, membersRes] = await Promise.all([
        fetch('/api/ideas', { cache: 'no-store' }),
        fetch('/api/members', { cache: 'no-store' })
      ]);
      
      if (ideasRes.ok) setIdeas(await ideasRes.json());
      if (membersRes.ok) setMembers(await membersRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading]);

  // Handle default form memberId
  useEffect(() => {
    if (currentUserId && !formData.memberId) {
      setFormData(prev => ({ ...prev, memberId: currentUserId }));
    }
  }, [currentUserId, formData.memberId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = { ...formData };
    if (payload.link) {
      payload.description = payload.description 
        ? `${payload.description}\n\n🔗 ${payload.link}`
        : `🔗 ${payload.link}`;
    }

    await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setIsModalOpen(false);
    setFormData({ title: '', description: '', link: '', company: '', priority: 'ปกติ', memberId: currentUserId || '' });
    fetchData();
  };

  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = idea.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (idea.description && idea.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Check filterStatus ('ทั้งหมด', 'วันนี้', 'รอดำเนินการ', 'รอตรวจ', 'เสร็จแล้ว')
    let matchesStatus = true;
    if (filterStatus !== 'ทั้งหมด') {
      if (filterStatus === 'วันนี้') {
        const today = new Date().toDateString();
        matchesStatus = new Date(idea.createdAt).toDateString() === today;
      } else {
        matchesStatus = idea.status === filterStatus;
      }
    }
    
    // Because this is for "each person sees their own tasks by default" but "can view others",
    // wait! We didn't add a filter for "My Tasks" vs "All Tasks". The screenshot has a dropdown for "ผู้รับผิดชอบ" (Owner).
    // The requirement says "เข้าหน้ามาเห็นแค่งานตัวเองเป็นค่าเริ่มต้น แต่เปิดดูคนอื่นได้"
    // Let's add an explicit filter for this. We will use a local state that defaults to currentUserId.

    return matchesSearch && matchesStatus;
  });

  // Adding Owner filter to meet requirement
  const [filterOwnerId, setFilterOwnerId] = useState<string>('my_tasks'); // Default

  useEffect(() => {
    if (currentUserId && filterOwnerId === 'my_tasks' && members.length > 0) {
      const user = members.find(m => m.id === currentUserId);
      if (user?.role === 'Admin') {
        setFilterOwnerId('all');
      } else {
        setFilterOwnerId(currentUserId);
      }
    }
  }, [currentUserId, members]);

  const finalFilteredIdeas = filteredIdeas.filter(idea => {
    if (filterOwnerId === 'all') return true;
    return idea.memberId?.includes(filterOwnerId);
  });

  const selectedIdea = ideas.find(i => i.id === selectedIdeaId);

  const handleToggleStar = async (ideaId: string) => {
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea || !currentUserId) return;
    
    const starredBy = idea.recommendedFor ? idea.recommendedFor.split(',') : [];
    let newStarredBy;
    if (starredBy.includes(currentUserId)) {
      newStarredBy = starredBy.filter((id: string) => id !== currentUserId);
    } else {
      newStarredBy = [...starredBy, currentUserId];
    }
    
    // Optimistic UI update
    setIdeas(ideas.map(i => i.id === ideaId ? { ...i, recommendedFor: newStarredBy.join(',') } : i));
    
    await fetch('/api/ideas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ideaId, title: idea.title, recommendedFor: newStarredBy.join(',') })
    });
    fetchData();
  };

  if (loading || authLoading) return <div className="loading-container"><div className="loading-spinner"></div></div>;

  return (
    <div style={{ padding: '2rem', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>โน๊ตงาน</h1>
        <div style={{ position: 'relative', width: '300px' }}>
          <HiMagnifyingGlass style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} size={20} />
          <input 
            type="text" 
            placeholder="ค้นหาโน๊ต, โปรเจกต์, ผู้รับผิดชอบ..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', backgroundColor: 'white', outline: 'none' }}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['ทั้งหมด', 'วันนี้', 'รอดำเนินการ', 'รอตรวจ', 'เสร็จแล้ว'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '24px',
                border: filterStatus === status ? '1px solid #818cf8' : '1px solid #e2e8f0',
                backgroundColor: filterStatus === status ? '#eef2ff' : 'white',
                color: filterStatus === status ? '#4f46e5' : '#64748b',
                fontWeight: filterStatus === status ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {status}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select
            value={filterOwnerId}
            onChange={(e) => setFilterOwnerId(e.target.value)}
            style={{ padding: '0.5rem 1rem', borderRadius: '24px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#475569', outline: 'none' }}
          >
            <option value="all">ดูงานของทุกคน</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name} {m.id === currentUserId ? '(ฉัน)' : ''}</option>
            ))}
          </select>
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ backgroundColor: '#4f46e5', color: 'white', padding: '0.5rem 1rem', borderRadius: '24px', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }}
          >
            <HiPlus size={18} /> เพิ่มโน๊ตใหม่
          </button>
        </div>
      </div>

      {/* Main Content Area (2-column) */}
      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, minHeight: 0 }}>
        {/* Left List */}
        <div style={{ 
          width: selectedIdeaId ? '35%' : '100%', 
          overflowY: 'auto', 
          paddingRight: '0.5rem', 
          transition: 'width 0.3s ease',
          display: selectedIdeaId ? 'flex' : 'grid',
          flexDirection: selectedIdeaId ? 'column' : 'initial',
          gridTemplateColumns: selectedIdeaId ? 'none' : 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1rem',
          alignContent: 'start'
        }}>
          {finalFilteredIdeas.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>ไม่พบโน๊ตงาน</div>
          ) : (
            finalFilteredIdeas.map(idea => (
              <IdeaCard 
                key={idea.id} 
                idea={idea} 
                members={members} 
                isSelected={selectedIdeaId === idea.id} 
                onClick={() => setSelectedIdeaId(idea.id)} 
                currentUserId={currentUserId || undefined}
                onToggleStar={handleToggleStar}
              />
            ))
          )}
        </div>

        {/* Right Detail Pane */}
        {selectedIdeaId && selectedIdea && (
          <div style={{ width: '65%', animation: 'slideIn 0.3s ease' }}>
            <IdeaDetailPane 
              idea={selectedIdea} 
              members={members} 
              onClose={() => setSelectedIdeaId(null)} 
              onUpdate={fetchData} 
              currentUserId={currentUserId}
            />
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="สร้างโน๊ตไอเดียใหม่">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">หัวข้อ <span style={{ color: 'red' }}>*</span></label>
            <input 
              type="text" 
              required
              className="form-input"
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="เช่น เสนอไอเดียถ่ายงานบ้านลูกค้า"
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">บริษัท</label>
              <select 
                className="form-select"
                value={formData.company} 
                onChange={e => setFormData({...formData, company: e.target.value})}
              >
                <option value="">ไม่ระบุ</option>
                <option value="GFS">GFS</option>
                <option value="MHL">MHL</option>
                <option value="CAR">CAR</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">ความสำคัญ</label>
              <select 
                className="form-select"
                value={formData.priority} 
                onChange={e => setFormData({...formData, priority: e.target.value})}
              >
                <option value="ปกติ">ปกติ</option>
                <option value="ด่วน">ด่วน</option>
                <option value="ด่วนมาก">ด่วนมาก</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">ลิงก์ที่เกี่ยวข้อง (URL)</label>
            <input 
              type="url"
              className="form-input"
              value={formData.link || ''} 
              onChange={e => setFormData({...formData, link: e.target.value})}
              placeholder="https://..."
              style={{ marginBottom: '1rem' }}
            />
            <label className="form-label">รายละเอียด</label>
            <textarea 
              rows={4}
              className="form-textarea"
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="รายละเอียดเพิ่มเติมของไอเดีย..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">ยกเลิก</button>
            <button type="submit" className="btn btn-primary">สร้างโน๊ต</button>
          </div>
        </form>
      </Modal>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        /* Custom scrollbar for better aesthetics */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}
