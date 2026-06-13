'use client';

import { useEffect, useState } from 'react';
import { HiPlus, HiOutlineTrash, HiArrowRight, HiArrowLeft, HiDocumentText, HiClipboardDocumentList } from 'react-icons/hi2';
import Modal from '@/components/Modal';
import ConfirmModal from '@/components/ConfirmModal';
import MemberAvatar from '@/components/MemberAvatar';

interface UnifiedItem {
  itemType: 'task' | 'content';
  id: string; 
  title: string; 
  status: string;
  memberId: string;
  member?: { id: string; name: string; role: string; avatar: string | null };
  
  // Task specific
  description?: string | null;
  priority?: string;
  deadline?: string | null;

  // Content specific
  contentType?: string;
  platform?: string;
  publishDate?: string | null;
  company?: string;
  link?: string;
}

interface TeamMember {
  id: string; name: string; role: string; avatar: string | null; status: string;
}

export default function TaskBoard() {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMemberId, setFilterMemberId] = useState('');
  const [showAllDone, setShowAllDone] = useState(false);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<'task' | 'content'>('task');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'task' | 'content' } | null>(null);
  
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', memberId: '', priority: 'medium', deadline: '', kpiId: '', link: ''
  });
  
  const [contentForm, setContentForm] = useState({
    title: '', type: 'post', platform: 'Facebook', memberId: '', company: 'GFS', publishDate: '', kpiId: '', link: ''
  });

  const fetchData = async () => {
    try {
      const [tasksRes, contentsRes, membersRes, kpisRes] = await Promise.all([
        fetch('/api/tasks' + (filterMemberId ? `?memberId=${filterMemberId}` : '')),
        fetch('/api/content' + (filterMemberId ? `?memberId=${filterMemberId}` : '')),
        fetch('/api/members'),
        fetch('/api/kpis')
      ]);
      const tasksData = await tasksRes.json();
      const contentsData = await contentsRes.json();
      const membersData = await membersRes.json();
      const kpisData = await kpisRes.json();
      
      const tasksArr = Array.isArray(tasksData) ? tasksData : [];
      const contentsArr = Array.isArray(contentsData) ? contentsData : [];
      
      const unifiedTasks: UnifiedItem[] = tasksArr.map(t => ({
        ...t,
        itemType: 'task'
      }));
      
      const unifiedContents: UnifiedItem[] = contentsArr.map(c => ({
        ...c,
        itemType: 'content',
        contentType: c.type,
      }));

      // Some old contents might have 'draft' or 'published' status.
      unifiedContents.forEach(c => {
        if (c.status === 'draft') c.status = 'todo';
        if (c.status === 'published') c.status = 'done';
      });

      setItems([...unifiedTasks, ...unifiedContents]);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setKpis(Array.isArray(kpisData) ? kpisData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterMemberId]);

  const handleStatusChange = async (item: UnifiedItem, newStatus: string) => {
    try {
      // Optimistic update
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
      
      const endpoint = item.itemType === 'task' ? '/api/tasks' : '/api/content';
      
      await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: newStatus })
      });
      // Optionally re-fetch
    } catch (err) {
      console.error(err);
      fetchData(); // revert on error
    }
  };

  const handleDeleteClick = (id: string, type: 'task' | 'content') => {
    setItemToDelete({ id, type });
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const endpoint = itemToDelete.type === 'task' ? '/api/tasks' : '/api/content';
      await fetch(`${endpoint}?id=${itemToDelete.id}`, { method: 'DELETE' });
      setItemToDelete(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        ...taskForm,
        deadline: taskForm.deadline ? new Date(taskForm.deadline).toISOString() : null
      };
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setIsModalOpen(false);
      setTaskForm({ title: '', description: '', memberId: '', priority: 'medium', deadline: '', kpiId: '', link: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleContentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        ...contentForm,
        status: 'todo', // initial status
        publishDate: contentForm.publishDate ? new Date(contentForm.publishDate).toISOString() : null
      };
      await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setIsModalOpen(false);
      setContentForm({ title: '', type: 'post', platform: 'Facebook', memberId: '', company: 'GFS', publishDate: '', kpiId: '', link: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    switch(priority) {
      case 'high': return <span className="badge priority-high">สูง</span>;
      case 'medium': return <span className="badge priority-medium">กลาง</span>;
      case 'low': return <span className="badge priority-low">ต่ำ</span>;
      default: return null;
    }
  };

  const renderColumn = (status: string, title: string) => {
    const columnItems = items.filter(t => t.status === status);
    const isDoneColumn = status === 'done';
    const displayedItems = isDoneColumn && !showAllDone ? columnItems.slice(0, 15) : columnItems;
    
    return (
      <div className={`kanban-column column-${status}`}>
        <div className="kanban-column-header">
          <span>{title}</span>
          <span className="task-count">{columnItems.length}</span>
        </div>
        
        <div className="kanban-cards-container">
          {displayedItems.map(item => (
            <div key={item.id} className={`task-card ${item.itemType === 'content' ? 'content-card' : ''}`} style={{ borderLeft: item.itemType === 'content' ? '4px solid var(--color-primary)' : 'none' }}>
              <div className="task-header">
                <h3 className="task-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {item.itemType === 'task' ? <HiClipboardDocumentList style={{ color: 'var(--color-text-secondary)' }} /> : <HiDocumentText style={{ color: 'var(--color-primary)' }} />}
                  {item.title}
                  {item.link && (
                    <a href={item.link.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', color: 'var(--color-primary)', display: 'inline-flex', padding: '0.2rem' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.1rem', height: '1.1rem' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                      </svg>
                    </a>
                  )}
                </h3>
                {item.itemType === 'task' ? getPriorityBadge(item.priority) : (
                  <span className="badge badge-secondary">{item.platform}</span>
                )}
              </div>
              
              {item.itemType === 'task' && item.description && <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>{item.description}</p>}
              {item.itemType === 'content' && (
                <div style={{ fontSize: '0.75rem', marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{item.company}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>• {item.contentType === 'video' ? 'วิดีโอ' : item.contentType === 'article' ? 'บทความ' : 'โพสต์'}</span>
                </div>
              )}
              
              <div className="task-meta">
                {item.member && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MemberAvatar name={item.member.name} size="sm" />
                    <span>{item.member.name}</span>
                  </div>
                )}
                {item.itemType === 'task' && item.deadline && (
                  <span style={{ marginLeft: 'auto', color: new Date(item.deadline) < new Date() ? 'var(--color-danger)' : 'inherit' }}>
                    📅 {new Date(item.deadline).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                {item.itemType === 'content' && item.publishDate && (
                  <span style={{ marginLeft: 'auto', color: new Date(item.publishDate) < new Date() ? 'var(--color-danger)' : 'inherit' }}>
                    📅 {new Date(item.publishDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
              
              <div className="task-footer">
                <button className="btn btn-icon btn-sm" style={{ color: 'var(--color-danger)', backgroundColor: 'transparent' }} onClick={() => handleDeleteClick(item.id, item.itemType)}>
                  <HiOutlineTrash />
                </button>
                <div className="task-actions">
                  {status === 'in_progress' || status === 'done' ? (
                    <button className="btn btn-sm btn-secondary" onClick={() => handleStatusChange(item, status === 'done' ? 'in_progress' : 'todo')}>
                      <HiArrowLeft />
                    </button>
                  ) : null}
                  
                  {status === 'todo' || status === 'in_progress' ? (
                    <button className="btn btn-sm btn-secondary" onClick={() => handleStatusChange(item, status === 'todo' ? 'in_progress' : 'done')}>
                      <HiArrowRight />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          
          {isDoneColumn && columnItems.length > 15 && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowAllDone(!showAllDone)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface-hover)' }}
              >
                {showAllDone ? 'ซ่อนการ์ด' : `แสดงเพิ่มเติมอีก ${columnItems.length - 15} การ์ด`}
              </button>
            </div>
          )}

          {columnItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              ไม่มีข้อมูลในคอลัมน์นี้
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="loading-container"><div className="loading-spinner"></div></div>;

  return (
    <div style={{ padding: '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label className="form-label" style={{ marginBottom: 0 }}>กรองตามพนักงาน:</label>
          <select 
            className="form-select" 
            style={{ width: '200px' }}
            value={filterMemberId}
            onChange={(e) => setFilterMemberId(e.target.value)}
          >
            <option value="">-- ทั้งหมด --</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => { setNewItemType('task'); setIsModalOpen(true); }}>
            <HiPlus /> เพิ่มงานทั่วไป
          </button>
          <button className="btn btn-primary" onClick={() => { setNewItemType('content'); setIsModalOpen(true); }}>
            <HiPlus /> เพิ่มคอนเท้น
          </button>
        </div>
      </div>

      <div className="kanban-board">
        {renderColumn('todo', 'รอดำเนินการ')}
        {renderColumn('in_progress', 'กำลังทำ')}
        {renderColumn('done', 'เสร็จแล้ว')}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={newItemType === 'task' ? "เพิ่มงานใหม่" : "เพิ่มคอนเท้นใหม่"}>
        {newItemType === 'task' ? (
          <form onSubmit={handleTaskSubmit}>
            <div className="form-group">
              <label className="form-label">ชื่องาน *</label>
              <input type="text" className="form-input" required value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">รายละเอียด</label>
              <textarea className="form-textarea" value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})}></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">ลิงก์ตรวจสอบงาน (ถ้ามี)</label>
              <input type="text" className="form-input" placeholder="เช่น https://docs.google.com/..." value={taskForm.link} onChange={e => setTaskForm({...taskForm, link: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">ผู้รับผิดชอบ *</label>
              <select className="form-select" required value={taskForm.memberId} onChange={e => setTaskForm({...taskForm, memberId: e.target.value, kpiId: ''})}>
                <option value="">-- เลือกผู้รับผิดชอบ --</option>
                {members.filter(m => m.status !== 'inactive').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            {taskForm.memberId && kpis.filter(k => k.memberId === taskForm.memberId).length > 0 && (
              <div className="form-group" style={{ backgroundColor: 'var(--color-surface-hover)', padding: '1rem', borderRadius: '8px' }}>
                <label className="form-label" style={{ color: 'var(--color-primary)' }}>เชื่อมโยงกับเป้าหมาย KPI (เพื่ออัปเดตอัตโนมัติ)</label>
                <select className="form-select" value={taskForm.kpiId} onChange={e => setTaskForm({...taskForm, kpiId: e.target.value})}>
                  <option value="">-- ไม่เชื่อมโยง --</option>
                  {kpis.filter(k => k.memberId === taskForm.memberId).map(k => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">ลำดับความสำคัญ</label>
                <select className="form-select" value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value})}>
                  <option value="low">ต่ำ</option>
                  <option value="medium">กลาง</option>
                  <option value="high">สูง</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">กำหนดส่ง</label>
                <input type="date" className="form-input" value={taskForm.deadline} onChange={e => setTaskForm({...taskForm, deadline: e.target.value})} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
              <button type="submit" className="btn btn-primary">บันทึกงาน</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleContentSubmit}>
            <div className="form-group">
              <label className="form-label">ชื่อคอนเท้น *</label>
              <input type="text" className="form-input" required value={contentForm.title} onChange={e => setContentForm({...contentForm, title: e.target.value})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">ประเภท</label>
                <select className="form-select" value={contentForm.type} onChange={e => setContentForm({...contentForm, type: e.target.value})}>
                  <option value="article">บทความ</option>
                  <option value="post">โพสต์</option>
                  <option value="video">วิดีโอ</option>
                  <option value="graphic">กราฟิก</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">แพลตฟอร์ม</label>
                <select className="form-select" value={contentForm.platform} onChange={e => setContentForm({...contentForm, platform: e.target.value})}>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Blog">Blog</option>
                  <option value="YouTube">YouTube</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">บริษัท *</label>
                <select className="form-select" required value={contentForm.company} onChange={e => setContentForm({...contentForm, company: e.target.value})}>
                  <option value="GFS">GFS</option>
                  <option value="MHL">MHL</option>
                  <option value="CAR">CAR</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ผู้สร้าง *</label>
                <select className="form-select" required value={contentForm.memberId} onChange={e => setContentForm({...contentForm, memberId: e.target.value, kpiId: ''})}>
                  <option value="">-- เลือกผู้รับผิดชอบ --</option>
                  {members.filter(m => m.status !== 'inactive').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            {contentForm.memberId && kpis.filter(k => k.memberId === contentForm.memberId).length > 0 && (
              <div className="form-group" style={{ backgroundColor: 'var(--color-surface-hover)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                <label className="form-label" style={{ color: 'var(--color-primary)' }}>เชื่อมโยงกับเป้าหมาย KPI (เพื่ออัปเดตอัตโนมัติ)</label>
                <select className="form-select" value={contentForm.kpiId} onChange={e => setContentForm({...contentForm, kpiId: e.target.value})}>
                  <option value="">-- ไม่เชื่อมโยง --</option>
                  {kpis.filter(k => k.memberId === contentForm.memberId).map(k => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">ลิงก์ผลงาน (ถ้ามี)</label>
              <input type="text" className="form-input" placeholder="เช่น https://facebook.com/..." value={contentForm.link} onChange={e => setContentForm({...contentForm, link: e.target.value})} />
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">วันที่เผยแพร่</label>
              <input type="date" className="form-input" value={contentForm.publishDate} onChange={e => setContentForm({...contentForm, publishDate: e.target.value})} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
              <button type="submit" className="btn btn-primary">บันทึกคอนเท้น</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title={`ยืนยันการลบ${itemToDelete?.type === 'task' ? 'งาน' : 'คอนเท้น'}`}
        message="คุณต้องการลบข้อมูลนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้"
      />
    </div>
  );
}
