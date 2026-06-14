'use client';

import { useEffect, useState } from 'react';
import { HiPlus, HiOutlineTrash, HiOutlinePencilSquare, HiArrowRight, HiArrowLeft, HiDocumentText, HiClipboardDocumentList, HiDotsVertical } from 'react-icons/hi2';
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
  startDate?: string | null;
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
  const [mobileTab, setMobileTab] = useState('todo');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<'task' | 'content'>('task');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'task' | 'content' } | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', memberId: '', priority: 'medium', startDate: '', deadline: '', kpiId: '', link: ''
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
    
    // Auto-refresh data every 2 minutes (120,000 ms)
    const interval = setInterval(() => {
      fetchData();
    }, 120000);
    
    return () => clearInterval(interval);
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

  const handleEditClick = (item: UnifiedItem) => {
    setIsEditing(true);
    setEditingItemId(item.id);
    setNewItemType(item.itemType);
    
    if (item.itemType === 'task') {
      setTaskForm({
        title: item.title || '',
        description: item.description || '',
        memberId: item.memberId || '',
        priority: item.priority || 'medium',
        startDate: item.startDate ? item.startDate.split('T')[0] : '',
        deadline: item.deadline ? item.deadline.split('T')[0] : '',
        kpiId: (item as any).kpiId || '',
        link: item.link || ''
      });
    } else {
      setContentForm({
        title: item.title || '',
        type: item.contentType || 'post',
        platform: item.platform || 'Facebook',
        memberId: item.memberId || '',
        company: item.company || 'GFS',
        publishDate: item.publishDate ? new Date(item.publishDate).toISOString().split('T')[0] : '',
        kpiId: (item as any).kpiId || '',
        link: item.link || ''
      });
    }
    setIsModalOpen(true);
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        ...taskForm,
        deadline: taskForm.deadline ? new Date(taskForm.deadline).toISOString() : null
      };
      
      if (isEditing && editingItemId) {
        await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItemId, ...body })
        });
      } else {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }
      setIsModalOpen(false);
      setTaskForm({ title: '', description: '', memberId: '', priority: 'medium', startDate: '', deadline: '', kpiId: '', link: '' });
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
        status: isEditing ? undefined : 'todo', // initial status only on create
        publishDate: contentForm.publishDate ? new Date(contentForm.publishDate).toISOString() : null
      };
      
      if (isEditing && editingItemId) {
        await fetch('/api/content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItemId, ...body })
        });
      } else {
        await fetch('/api/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }
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
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="btn btn-icon btn-sm" style={{ color: 'var(--color-secondary)', backgroundColor: 'transparent' }} onClick={() => handleEditClick(item)} title="แก้ไข">
                    <HiOutlinePencilSquare />
                  </button>
                  <button className="btn btn-icon btn-sm" style={{ color: 'var(--color-danger)', backgroundColor: 'transparent' }} onClick={() => handleDeleteClick(item.id, item.itemType)} title="ลบ">
                    <HiOutlineTrash />
                  </button>
                </div>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto' }}>
          <label className="form-label desktop-only" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>กรองตามพนักงาน:</label>
          <select 
            className="form-select" 
            style={{ width: '100%', minWidth: '150px', maxWidth: '250px' }}
            value={filterMemberId}
            onChange={(e) => setFilterMemberId(e.target.value)}
          >
            <option value="">-- พนักงานทั้งหมด --</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 auto' }}>
          <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setIsEditing(false); setNewItemType('task'); setTaskForm({ title: '', description: '', memberId: '', priority: 'medium', startDate: '', deadline: '', kpiId: '', link: '' }); setIsModalOpen(true); }}>
            <HiPlus /> เพิ่มงานทั่วไป
          </button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setIsEditing(false); setNewItemType('content'); setContentForm({ title: '', type: 'post', platform: 'Facebook', memberId: '', company: 'GFS', publishDate: '', kpiId: '', link: '' }); setIsModalOpen(true); }}>
            <HiPlus /> เพิ่มคอนเท้น
          </button>
        </div>
      </div>

      <div className="desktop-only">
        <div className="kanban-board">
          {renderColumn('todo', 'รอดำเนินการ')}
          {renderColumn('in_progress', 'กำลังทำ')}
          {renderColumn('done', 'เสร็จแล้ว')}
        </div>
      </div>

      <div className="mobile-only" style={{ paddingBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
          {['todo', 'in_progress', 'done'].map((tab) => {
            const count = items.filter(i => i.status === tab).length;
            const isActive = mobileTab === tab;
            const colors = {
              todo: { text: '#f97316', bg: '#fffbeb', badgeText: 'white', badgeBg: '#f97316' },
              in_progress: { text: '#3b82f6', bg: '#eff6ff', badgeText: 'white', badgeBg: '#3b82f6' },
              done: { text: '#10b981', bg: '#ecfdf5', badgeText: 'white', badgeBg: '#10b981' }
            };
            const inactiveColors = { text: '#64748b', bg: '#f8fafc', badgeText: '#64748b', badgeBg: '#e2e8f0' };
            const currentColors = isActive ? colors[tab as keyof typeof colors] : inactiveColors;
            const labels = { todo: 'รอดำเนินการ', in_progress: 'กำลังทำ', done: 'เสร็จแล้ว' };
            
            return (
              <button 
                key={tab}
                onClick={() => setMobileTab(tab)}
                style={{ position: 'relative', flex: 1, padding: '0.75rem 0.5rem', borderRadius: '12px', border: 'none', backgroundColor: currentColors.bg, color: currentColors.text, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', minWidth: '100px' }}
              >
                {labels[tab as keyof typeof labels]}
                <span style={{ backgroundColor: currentColors.badgeBg, color: currentColors.badgeText, padding: '0.1rem 0.4rem', borderRadius: '10px', fontSize: '0.7rem' }}>{count}</span>
                {isActive && <div style={{ position: 'absolute', bottom: '-0.5rem', left: '10%', right: '10%', height: '3px', backgroundColor: currentColors.text, borderRadius: '3px' }} />}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.filter(i => i.status === mobileTab).map(item => {
            const isTask = item.itemType === 'task';
            const iconColor = item.status === 'todo' ? '#f97316' : item.status === 'in_progress' ? '#3b82f6' : '#10b981';
            
            return (
              <div key={item.id} onClick={() => handleEditClick(item)} style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer' }}>
                <div 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    const nextStatus = item.status === 'todo' ? 'in_progress' : item.status === 'in_progress' ? 'done' : 'todo';
                    handleStatusChange(item, nextStatus); 
                  }}
                  style={{ width: '22px', height: '22px', borderRadius: '6px', border: item.status === 'done' ? 'none' : '2px solid #cbd5e1', backgroundColor: item.status === 'done' ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.15rem' }}
                >
                  {item.status === 'done' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </div>
                
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                        {item.link && (
                          <a href={item.link.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--color-primary)', display: 'inline-flex', flexShrink: 0 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.1rem', height: '1.1rem' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                            </svg>
                          </a>
                        )}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isTask ? item.description || 'ไม่มีรายละเอียด' : `${item.contentType === 'video' ? 'วิดีโอ' : item.contentType === 'article' ? 'บทความ' : 'โพสต์'} - ${item.company}`}
                      </p>
                    </div>
                    <button style={{ background: 'none', border: 'none', color: '#94a3b8', padding: '0', cursor: 'pointer', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id, item.itemType); }}><HiDotsVertical size={20} /></button>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        {item.deadline || item.publishDate ? new Date(item.deadline || item.publishDate || '').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' 10:00' : 'ไม่ระบุ'}
                      </div>
                      {item.member && (
                        <MemberAvatar name={item.member.name} size="sm" />
                      )}
                    </div>
                    
                    <span style={{ backgroundColor: item.status === 'todo' ? '#fffbeb' : item.status === 'in_progress' ? '#eff6ff' : '#ecfdf5', color: iconColor, padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {item.status === 'todo' ? 'รอดำเนินการ' : item.status === 'in_progress' ? 'กำลังทำ' : 'เสร็จแล้ว'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {items.filter(i => i.status === mobileTab).length === 0 && (
             <div style={{ padding: '3rem 1rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
               <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>ไม่มีงานในหมวดหมู่นี้</p>
             </div>
          )}
        </div>

        <button 
          onClick={() => { setIsEditing(false); setNewItemType('content'); setContentForm({ title: '', type: 'post', platform: 'Facebook', memberId: '', company: 'GFS', publishDate: '', kpiId: '', link: '' }); setIsModalOpen(true); }}
          style={{ position: 'fixed', bottom: '80px', right: '20px', width: '60px', height: '60px', borderRadius: '30px', backgroundColor: '#3b82f6', color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, cursor: 'pointer' }}
        >
          <HiPlus size={32} />
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? (newItemType === 'task' ? "แก้ไขงาน" : "แก้ไขคอนเท้น") : (newItemType === 'task' ? "เพิ่มงานใหม่" : "เพิ่มคอนเท้นใหม่")}>
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

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.25rem' }}>วันเริ่มต้น (ถ้ามี)</label>
                <input type="date" className="form-input" style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', boxSizing: 'border-box' }} value={taskForm.startDate} onChange={e => setTaskForm({...taskForm, startDate: e.target.value})} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.25rem' }}>กำหนดส่ง *</label>
                <input type="date" className="form-input" required style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', boxSizing: 'border-box' }} value={taskForm.deadline} onChange={e => setTaskForm({...taskForm, deadline: e.target.value, kpiId: ''})} />
              </div>
            </div>
            {taskForm.memberId ? (
              taskForm.deadline ? (
                kpis.filter(k => k.memberId === taskForm.memberId && k.month === new Date(taskForm.deadline).getMonth() + 1 && k.year === new Date(taskForm.deadline).getFullYear()).length > 0 ? (
                  <div className="form-group" style={{ backgroundColor: 'var(--color-surface-hover)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                    <label className="form-label" style={{ color: 'var(--color-primary)' }}>เชื่อมโยงกับเป้าหมาย KPI ประจำเดือนที่กำหนดส่ง</label>
                    <select className="form-select" value={taskForm.kpiId} onChange={e => setTaskForm({...taskForm, kpiId: e.target.value})}>
                      <option value="">-- ไม่เชื่อมโยง --</option>
                      {kpis.filter(k => k.memberId === taskForm.memberId && k.month === new Date(taskForm.deadline).getMonth() + 1 && k.year === new Date(taskForm.deadline).getFullYear()).sort((a, b) => a.name.length - b.name.length).map(k => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group" style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginTop: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    ไม่พบเป้าหมาย KPI ของพนักงานท่านนี้ในเดือนที่เลือก
                  </div>
                )
              ) : (
                <div className="form-group" style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginTop: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                  กรุณาระบุกำหนดส่งด้านบนเพื่อดึงข้อมูลเป้าหมาย KPI
                </div>
              )
            ) : null}
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
            <div className="form-row">
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
                  <option value="Website">Website</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Google Map">Google Map</option>
                </select>
              </div>
            </div>
            <div className="form-row mt-4">
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
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">ลิงก์ผลงาน (ถ้ามี)</label>
              <input type="text" className="form-input" placeholder="เช่น https://facebook.com/..." value={contentForm.link} onChange={e => setContentForm({...contentForm, link: e.target.value})} />
            </div>
            <div style={{ marginTop: '1rem', width: '100%', maxWidth: '100%', overflow: 'hidden', marginBottom: '1.25rem' }}>
              <label className="form-label">วันที่เผยแพร่ *</label>
              <input type="date" className="form-input" required style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', boxSizing: 'border-box', maxWidth: '100%' }} value={contentForm.publishDate} onChange={e => setContentForm({...contentForm, publishDate: e.target.value, kpiId: ''})} />
            </div>
            {contentForm.memberId ? (
              contentForm.publishDate ? (
                kpis.filter(k => k.memberId === contentForm.memberId && k.month === new Date(contentForm.publishDate).getMonth() + 1 && k.year === new Date(contentForm.publishDate).getFullYear()).length > 0 ? (
                  <div className="form-group" style={{ backgroundColor: 'var(--color-surface-hover)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                    <label className="form-label" style={{ color: 'var(--color-primary)' }}>เชื่อมโยงกับเป้าหมาย KPI ประจำเดือนที่เผยแพร่</label>
                    <select className="form-select" value={contentForm.kpiId} onChange={e => setContentForm({...contentForm, kpiId: e.target.value})}>
                      <option value="">-- ไม่เชื่อมโยง --</option>
                      {kpis.filter(k => k.memberId === contentForm.memberId && k.month === new Date(contentForm.publishDate).getMonth() + 1 && k.year === new Date(contentForm.publishDate).getFullYear()).sort((a, b) => a.name.length - b.name.length).map(k => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group" style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginTop: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    ไม่พบเป้าหมาย KPI ของพนักงานท่านนี้ในเดือนที่เลือก
                  </div>
                )
              ) : (
                <div className="form-group" style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginTop: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                  กรุณาระบุวันที่เผยแพร่ด้านบนเพื่อดึงข้อมูลเป้าหมาย KPI
                </div>
              )
            ) : null}
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
