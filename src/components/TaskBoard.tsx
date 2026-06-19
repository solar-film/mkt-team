'use client';

import { useEffect, useState } from 'react';
import { HiPlus, HiOutlineTrash, HiOutlinePencilSquare, HiArrowRight, HiArrowLeft, HiDocumentText, HiClipboardDocumentList, HiEllipsisVertical } from 'react-icons/hi2';
import Modal from '@/components/Modal';
import ConfirmModal from '@/components/ConfirmModal';
import MemberAvatar from '@/components/MemberAvatar';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import { getCompanyColor, getMemberColor } from '@/lib/colors';

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
  meetingId?: string;
}

interface TeamMember {
  id: string; name: string; role: string; avatar: string | null; status: string;
}

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  if (hours === '00' && minutes === '00') return datePart;
  return `${datePart} ${hours}:${minutes}`;
}

const isKpiMatchPlatform = (kpiName: string, platform: string) => {
  if (!platform) return true;
  const p = platform.toLowerCase();
  const k = kpiName.toLowerCase();
  if (p === 'facebook' && (k.includes('facebook') || k.includes('fb'))) return true;
  if (p === 'instagram' && (k.includes('instagram') || k.includes('ig'))) return true;
  if (p === 'tiktok' && (k.includes('tiktok') || k.includes('tt'))) return true;
  if (p === 'youtube' && (k.includes('youtube') || k.includes('yt'))) return true;
  if (p === 'icons' && k.includes('icons')) return true;
  return k.includes(p);
};

export default function TaskBoard() {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMemberId, setFilterMemberId] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterMonthYear, setFilterMonthYear] = useState<Date | null>(new Date());
  const [filterExactDate, setFilterExactDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllDone, setShowAllDone] = useState(false);
  const [mobileTab, setMobileTab] = useState('todo');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<'task' | 'content'>('task');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'task' | 'content' } | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<UnifiedItem | null>(null);
  const [validationAlert, setValidationAlert] = useState<{ isOpen: boolean; item: UnifiedItem | null }>({ isOpen: false, item: null });
  const [linkErrorOpen, setLinkErrorOpen] = useState(false);
  const [notifyLine, setNotifyLine] = useState(false);
  
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', memberId: '', priority: 'medium', startDate: '', deadline: '', kpiId: '', link: '', company: ''
  });
  
  const [contentForm, setContentForm] = useState({
    title: '', description: '', type: '', platform: '', memberId: '', company: '', publishDate: '', kpiId: '', link: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard' + (filterMemberId ? `?memberId=${filterMemberId}` : ''), { cache: 'no-store' });
      const data = await res.json();
      
      const tasksData = data.tasks;
      const contentsData = data.contents;
      const membersData = data.members;
      const kpisData = data.kpis;
      const meetingsData = data.meetings;
      
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
      setMeetings(Array.isArray(meetingsData) ? meetingsData : []);
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
    if (item.itemType === 'content' && newStatus === 'done' && !item.link) {
      setValidationAlert({ isOpen: true, item });
      return;
    }

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
        title: item.title,
        description: item.description || '',
        memberId: item.memberId || '',
        priority: item.priority || 'medium',
        startDate: item.startDate ? new Date(item.startDate).toISOString() : '',
        deadline: item.deadline ? new Date(item.deadline).toISOString() : '',
        kpiId: (item as any).kpiId || '',
        link: item.link || '',
        company: item.company || 'GFS'
      });
    } else {
      setContentForm({
        title: item.title || '',
        description: item.description || '',
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
    if (taskForm.link && !/^https?:\/\/.+/.test(taskForm.link)) {
      setLinkErrorOpen(true);
      return;
    }
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
          body: JSON.stringify({ ...body, notifyLine })
        });
      }
      setIsModalOpen(false);
      setTaskForm({ title: '', description: '', memberId: '', priority: 'medium', startDate: '', deadline: '', kpiId: '', link: '', company: '' });
      setNotifyLine(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleContentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contentForm.link && !/^https?:\/\/.+/.test(contentForm.link)) {
      setLinkErrorOpen(true);
      return;
    }
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
          body: JSON.stringify({ ...body, notifyLine })
        });
      }
      setIsModalOpen(false);
      setContentForm({ title: '', description: '', type: '', platform: '', memberId: '', company: '', publishDate: '', kpiId: '', link: '' });
      setNotifyLine(false);
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

  const filteredItems = items.filter(item => {
    if (filterMemberId && item.memberId !== filterMemberId && item.memberId !== 'all') return false;
    if (filterType !== 'all' && item.itemType !== filterType) return false;
    if (filterCompany !== 'all' && item.company !== filterCompany) return false;
    if (filterPlatform !== 'all' && item.platform !== filterPlatform) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q) || false;
      const matchDesc = item.description?.toLowerCase().includes(q) || false;
      const memberName = members.find(m => m.id === item.memberId)?.name || '';
      const matchMember = memberName.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchMember) return false;
    }
    if (filterExactDate) {
      const dateStr = item.deadline || item.publishDate || item.startDate;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (d.getDate() !== filterExactDate.getDate() || d.getMonth() !== filterExactDate.getMonth() || d.getFullYear() !== filterExactDate.getFullYear()) return false;
    } else if (filterMonthYear) {
      const dateStr = item.deadline || item.publishDate || item.startDate;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (d.getMonth() !== filterMonthYear.getMonth() || d.getFullYear() !== filterMonthYear.getFullYear()) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.status === 'done' && b.status === 'done') {
      const dateA = a.deadline || a.publishDate || a.startDate;
      const dateB = b.deadline || b.publishDate || b.startDate;
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    } else {
      const dateA = a.deadline || a.publishDate || a.startDate;
      const dateB = b.deadline || b.publishDate || b.startDate;
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    }
  });

  const renderColumn = (status: string, title: string) => {
    const columnItems = filteredItems.filter(t => t.status === status);
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
            <div key={item.id} onClick={() => setViewItem(item)} className={`task-card ${item.itemType === 'content' ? 'content-card' : ''}`} style={{ borderLeft: item.itemType === 'content' ? `4px solid ${getMemberColor(item.member?.name)}` : 'none', cursor: 'pointer' }}>
              <div className="task-header">
                <h3 className="task-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  <div style={{ flexShrink: 0, display: 'flex' }}>
                    {item.itemType === 'task' ? <HiClipboardDocumentList style={{ color: 'var(--color-text-secondary)' }} /> : <HiDocumentText style={{ color: 'var(--color-primary)' }} />}
                  </div>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                    {item.company ? `[${item.company}] ` : ''}{item.title}
                  </span>
                  {item.link && (
                    <a href={item.link.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', color: 'var(--color-primary)', display: 'inline-flex', padding: '0.2rem', flexShrink: 0 }}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.1rem', height: '1.1rem' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                      </svg>
                    </a>
                  )}
                </h3>
                <div style={{ flexShrink: 0, marginLeft: '0.5rem' }}>
                  {item.itemType === 'task' ? getPriorityBadge(item.priority) : (
                    <span className="badge badge-secondary">{item.platform}</span>
                  )}
                </div>
              </div>
              
              {item.itemType === 'task' && item.description && <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>{item.description}</p>}
              {item.itemType === 'content' && (
                <div style={{ fontSize: '0.75rem', marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{item.company}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>• {item.contentType === 'video' ? 'วิดีโอ' : item.contentType === 'article' ? 'บทความ' : item.contentType === 'graphic' ? 'กราฟิก' : item.contentType === 'reel' ? 'Reel' : 'โพสต์'}</span>
                </div>
              )}
              
              {item.meetingId && (
                <div style={{ fontSize: '0.75rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-secondary)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                  </svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {meetings.find(m => m.id === item.meetingId)?.title || 'จากการประชุม'}
                  </span>
                </div>
              )}
              
              <div className="task-meta">
                {item.memberId === 'all' ? (
                <div className="task-member">
                  {item.memberId === 'all' ? <span style={{ fontSize: '1.1rem' }}>👥</span> : <MemberAvatar name={item.member?.name || 'ไม่ระบุ'} size="sm" />}
                </div>
                <span>{item.member?.name || ''}</span>
                {item.itemType === 'task' && item.deadline && (
                  <span style={{ marginLeft: 'auto', color: new Date(item.deadline) < new Date() ? 'var(--color-danger)' : 'inherit' }}>
                    ถึง {formatDateTime(item.deadline)}
                  </span>
                )}
                {item.itemType === 'content' && item.publishDate && (
                  <span style={{ marginLeft: 'auto', color: new Date(item.publishDate) < new Date() ? 'var(--color-danger)' : 'inherit' }}>
                    เผยแพร่ {formatDateTime(item.publishDate)}
                  </span>
                )}
              </div>
              
              <div className="task-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: item.itemType === 'task' ? 'var(--color-text-secondary)' : 'var(--color-primary)', backgroundColor: item.itemType === 'task' ? '#f1f5f9' : '#e0e7ff', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    {item.itemType === 'task' ? 'งาน' : 'คอนเทนต์'}
                  </span>
                </div>
                <div className="task-actions" style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <button className="btn btn-icon btn-sm" style={{ color: 'var(--color-secondary)', backgroundColor: 'transparent' }} onClick={(e) => { e.stopPropagation(); handleEditClick(item); }} title="แก้ไข">
                    <HiOutlinePencilSquare />
                  </button>
                  <button className="btn btn-icon btn-sm" style={{ color: 'var(--color-danger)', backgroundColor: 'transparent' }} onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id, item.itemType); }} title="ลบ">
                    <HiOutlineTrash />
                  </button>
                  
                  <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-border)', margin: '0 4px' }}></div>
                  
                  {status === 'in_progress' || status === 'done' ? (
                    <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); handleStatusChange(item, status === 'done' ? 'in_progress' : 'todo'); }}>
                      <HiArrowLeft />
                    </button>
                  ) : null}
                  
                  {status === 'todo' || status === 'in_progress' ? (
                    <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); handleStatusChange(item, status === 'todo' ? 'in_progress' : 'done'); }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '1 1 auto', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 ค้นหา..."
            style={{ minWidth: '150px', maxWidth: '200px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select 
            className="form-select" 
            style={{ minWidth: '110px', maxWidth: '150px', padding: '0.4rem 1.5rem 0.4rem 0.75rem', fontSize: '0.85rem' }}
            value={filterMemberId}
            onChange={(e) => setFilterMemberId(e.target.value)}
          >
            <option value="">-- ทุกคน --</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select 
            className="form-select" 
            style={{ minWidth: '90px', maxWidth: '110px', padding: '0.4rem 1.5rem 0.4rem 0.75rem', fontSize: '0.85rem' }}
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
          >
            <option value="all">ทุกบริษัท</option>
            <option value="GFS">GFS</option>
            <option value="MHL">MHL</option>
            <option value="CAR">CAR</option>
          </select>
          <select 
            className="form-select" 
            style={{ minWidth: '90px', maxWidth: '110px', padding: '0.4rem 1.5rem 0.4rem 0.75rem', fontSize: '0.85rem' }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">ทุกประเภท</option>
            <option value="task">งานทั่วไป</option>
            <option value="content">คอนเทนต์</option>
          </select>
          <select 
            className="form-select" 
            style={{ minWidth: '110px', maxWidth: '130px', padding: '0.4rem 1.5rem 0.4rem 0.75rem', fontSize: '0.85rem' }}
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
          >
            <option value="all">ทุกแพลตฟอร์ม</option>
            <option value="Facebook">Facebook</option>
            <option value="Instagram">Instagram</option>
            <option value="TikTok">TikTok</option>
            <option value="iCONS">iCONS</option>
            <option value="YouTube">YouTube</option>
            <option value="Google Map">Google Map</option>
          </select>
          <div style={{ display: 'flex', gap: '0.4rem', zIndex: 10 }}>
            <div style={{ width: '90px' }}>
              <DatePicker
                selected={filterMonthYear}
                onChange={(date: Date | null) => { setFilterMonthYear(date); setFilterExactDate(null); }}
                onInputClick={() => setFilterExactDate(null)}
                dateFormat="MM/yyyy"
                showMonthYearPicker
                className="form-select"
                placeholderText="เดือน/ปี"
                wrapperClassName="w-full"
              />
            </div>
            <div style={{ width: '130px' }}>
              <DatePicker
                selected={filterExactDate}
                onChange={(date: Date | null) => { setFilterExactDate(date); setFilterMonthYear(null); }}
                onInputClick={() => setFilterMonthYear(null)}
                dateFormat="dd/MM/yyyy"
                className="form-select"
                placeholderText="📅 ระบุวันที่"
                isClearable
                wrapperClassName="w-full"
              />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => { setIsEditing(false); setNewItemType('task'); setTaskForm({ title: '', description: '', memberId: '', priority: 'medium', startDate: '', deadline: '', kpiId: '', link: '', company: '' }); setContentForm({ title: '', description: '', type: '', platform: '', memberId: '', company: '', publishDate: '', kpiId: '', link: '' }); setIsModalOpen(true); }}>
            <HiPlus /> เพิ่มรายการใหม่
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
            const count = filteredItems.filter(i => i.status === tab).length;
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
          {filteredItems.filter(i => i.status === mobileTab).map(item => {
            const isTask = item.itemType === 'task';
            const iconColor = item.status === 'todo' ? '#f97316' : item.status === 'in_progress' ? '#3b82f6' : '#10b981';
            
            return (
              <div key={item.id} onClick={() => setViewItem(item)} style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9', borderLeft: item.itemType === 'content' ? `4px solid ${getMemberColor(item.member?.name)}` : '1px solid #f1f5f9', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer' }}>
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
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{item.company ? <span style={{ color: getCompanyColor(item.company), marginRight: '4px' }}>[{item.company}]</span> : null}{item.title}</span>
                        {item.link && (
                          <a href={item.link.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--color-primary)', display: 'inline-flex', flexShrink: 0 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.1rem', height: '1.1rem' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                            </svg>
                          </a>
                        )}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isTask ? item.description || 'ไม่มีรายละเอียด' : `${item.contentType === 'video' ? 'วิดีโอ' : item.contentType === 'article' ? 'บทความ' : item.contentType === 'graphic' ? 'กราฟิก' : item.contentType === 'reel' ? 'Reel' : 'โพสต์'} - ${item.company}`}
                      </p>
                    </div>
                    <button style={{ background: 'none', border: 'none', color: '#94a3b8', padding: '0', cursor: 'pointer', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id, item.itemType); }}><HiEllipsisVertical size={20} /></button>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isTask ? 'var(--color-text-secondary)' : 'var(--color-primary)', backgroundColor: isTask ? '#f1f5f9' : '#e0e7ff', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                        {isTask ? 'งาน' : 'คอนเทนต์'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        {item.deadline || item.publishDate ? formatDateTime(item.deadline || item.publishDate || '') : 'ไม่ระบุ'}
                      </div>
                      <div className="task-member">
                        {item.memberId === 'all' ? <span style={{ fontSize: '1.1rem' }}>👥</span> : <MemberAvatar name={item.member?.name || 'ไม่ระบุ'} size="sm" />}
                      </div>
                    </div>
                    
                    <span style={{ backgroundColor: item.status === 'todo' ? '#fffbeb' : item.status === 'in_progress' ? '#eff6ff' : '#ecfdf5', color: iconColor, padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {item.status === 'todo' ? 'รอดำเนินการ' : item.status === 'in_progress' ? 'กำลังทำ' : 'เสร็จแล้ว'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredItems.filter(i => i.status === mobileTab).length === 0 && (
             <div style={{ padding: '3rem 1rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
               <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>ไม่มีงานในหมวดหมู่นี้</p>
             </div>
          )}
        </div>

        <button 
          onClick={() => { setIsEditing(false); setNewItemType('content'); setContentForm({ title: '', description: '', type: '', platform: '', memberId: '', company: '', publishDate: '', kpiId: '', link: '' }); setIsModalOpen(true); }}
          style={{ position: 'fixed', bottom: '80px', right: '20px', width: '60px', height: '60px', borderRadius: '30px', backgroundColor: '#3b82f6', color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, cursor: 'pointer' }}
        >
          <HiPlus size={32} />
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? (newItemType === 'task' ? "แก้ไขงาน" : "แก้ไขคอนเท้น") : "เพิ่มรายการใหม่"}>
        {!isEditing && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', padding: '0.25rem', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
            <button 
              type="button"
              onClick={() => setNewItemType('task')}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: 'none', backgroundColor: newItemType === 'task' ? 'white' : 'transparent', color: newItemType === 'task' ? '#3b82f6' : '#64748b', fontWeight: newItemType === 'task' ? 600 : 500, boxShadow: newItemType === 'task' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              งานทั่วไป
            </button>
            <button 
              type="button"
              onClick={() => setNewItemType('content')}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: 'none', backgroundColor: newItemType === 'content' ? 'white' : 'transparent', color: newItemType === 'content' ? '#3b82f6' : '#64748b', fontWeight: newItemType === 'content' ? 600 : 500, boxShadow: newItemType === 'content' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              คอนเทนต์
            </button>
          </div>
        )}
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
              <input type="url" pattern="https?://.*" title="ต้องขึ้นต้นด้วย http:// หรือ https://" className="form-input" placeholder="เช่น https://docs.google.com/..." value={taskForm.link} onChange={e => setTaskForm({...taskForm, link: e.target.value})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">ผู้รับผิดชอบ *</label>
                <select className="form-select" required value={taskForm.memberId} onChange={e => setTaskForm({...taskForm, memberId: e.target.value, kpiId: ''})}>
                  <option value="">-- เลือกผู้รับผิดชอบ --</option>
                  <option value="all">👥 ทุกคน</option>
                  {members.filter(m => m.status !== 'inactive').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">บริษัท/แบรนด์ *</label>
                <select className="form-select" required value={taskForm.company} onChange={e => setTaskForm({...taskForm, company: e.target.value})}>
                  <option value="">-- เลือกบริษัท/แบรนด์ --</option>
                  <option value="GFS">GFS</option>
                  <option value="MHL">MHL</option>
                  <option value="CAR">CAR</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">ความสำคัญ *</label>
              <select className="form-select" required value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value})}>
                <option value="high">สูง</option>
                <option value="medium">ปานกลาง</option>
                <option value="low">ต่ำ</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.25rem' }}>วันเริ่มต้น (ถ้ามี)</label>
                <DatePicker 
                  selected={taskForm.startDate ? new Date(taskForm.startDate) : null} 
                  onChange={(date: Date | null) => setTaskForm({...taskForm, startDate: date && !isNaN(date.getTime()) ? date.toISOString() : ''})} 
                  dateFormat="dd/MM/yyyy HH:mm"
                  showTimeSelect
                  timeFormat="HH:mm"
                  className="form-input" 
                  placeholderText="วว/ดด/ปปปป HH:mm"
                  isClearable
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.25rem' }}>วันครบกำหนด *</label>
                <DatePicker 
                  selected={taskForm.deadline ? new Date(taskForm.deadline) : null} 
                  onChange={(date: Date | null) => setTaskForm({...taskForm, deadline: date && !isNaN(date.getTime()) ? date.toISOString() : '', kpiId: ''})} 
                  dateFormat="dd/MM/yyyy HH:mm"
                  showTimeSelect
                  timeFormat="HH:mm"
                  className="form-input" 
                  placeholderText="วว/ดด/ปปปป HH:mm"
                  required
                />
              </div>
            </div>
            {/* KPI selection removed from tasks as per user request (automatically handled in backend) */}
            {!isEditing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <input type="checkbox" id="notifyLineTask" checked={notifyLine} onChange={e => setNotifyLine(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#22c55e', cursor: 'pointer' }} />
                <label htmlFor="notifyLineTask" style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#15803d', fontWeight: 500 }}>🔔 แจ้งเตือนผ่าน LINE</label>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
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
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">รายละเอียดงาน</label>
              <textarea className="form-input" rows={3} value={contentForm.description} onChange={e => setContentForm({...contentForm, description: e.target.value})} />
            </div>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">ประเภท *</label>
                <select className="form-select" required value={contentForm.type} onChange={e => setContentForm({...contentForm, type: e.target.value})}>
                  <option value="">-- เลือกประเภท --</option>
                  <option value="article">บทความ</option>
                  <option value="post">โพสต์</option>
                  <option value="video">วิดีโอ</option>
                  <option value="graphic">กราฟิก</option>
                  <option value="reel">Reel</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">แพลตฟอร์ม *</label>
                <select className="form-select" required value={contentForm.platform} onChange={e => setContentForm({...contentForm, platform: e.target.value})}>
                  <option value="">-- เลือกแพลตฟอร์ม --</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="TikTok">TikTok</option>
                  <option value="iCONS">iCONS</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Google Map">Google Map</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">ผู้รับผิดชอบ *</label>
                <select className="form-select" required value={contentForm.memberId} onChange={e => setContentForm({...contentForm, memberId: e.target.value, kpiId: ''})}>
                  <option value="">-- เลือกผู้รับผิดชอบ --</option>
                  {members.filter(m => m.status !== 'inactive').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">บริษัท/แบรนด์ *</label>
                <select className="form-select" required value={contentForm.company} onChange={e => setContentForm({...contentForm, company: e.target.value})}>
                  <option value="">-- เลือกบริษัท/แบรนด์ --</option>
                  <option value="GFS">GFS</option>
                  <option value="MHL">MHL</option>
                  <option value="CAR">CAR</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">ลิงก์ผลงาน (ถ้ามี)</label>
              <input type="text" className="form-input" placeholder="เช่น https://facebook.com/..." value={contentForm.link} onChange={e => setContentForm({...contentForm, link: e.target.value})} />
            </div>
            <div style={{ marginTop: '1rem', width: '100%', maxWidth: '100%', overflow: 'hidden', marginBottom: '1.25rem' }}>
              <label className="form-label">วันที่เผยแพร่ *</label>
              <DatePicker 
                selected={contentForm.publishDate ? new Date(contentForm.publishDate) : null} 
                onChange={(date: Date | null) => setContentForm({...contentForm, publishDate: date && !isNaN(date.getTime()) ? date.toISOString() : '', kpiId: ''})} 
                dateFormat="dd/MM/yyyy HH:mm"
                showTimeSelect
                timeFormat="HH:mm"
                className="form-input" 
                placeholderText="วว/ดด/ปปปป HH:mm"
                required
              />
            </div>
            {contentForm.memberId ? (
              contentForm.publishDate ? (
                kpis.filter(k => k.memberId === contentForm.memberId && k.month === new Date(contentForm.publishDate).getMonth() + 1 && k.year === new Date(contentForm.publishDate).getFullYear() && k.name !== 'งานทั่วไป' && isKpiMatchPlatform(k.name, contentForm.platform)).length > 0 ? (
                  <div className="form-group" style={{ backgroundColor: 'var(--color-surface-hover)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                    <label className="form-label" style={{ color: 'var(--color-primary)' }}>ผูกกับเป้าหมาย KPI (บังคับ) *</label>
                    <select className="form-select" required value={contentForm.kpiId} onChange={e => setContentForm({...contentForm, kpiId: e.target.value})}>
                      <option value="">-- ไม่เชื่อมโยง --</option>
                      {kpis.filter(k => k.memberId === contentForm.memberId && k.month === new Date(contentForm.publishDate).getMonth() + 1 && k.year === new Date(contentForm.publishDate).getFullYear() && k.name !== 'งานทั่วไป' && isKpiMatchPlatform(k.name, contentForm.platform)).sort((a, b) => a.name.length - b.name.length).map(k => (
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
            {!isEditing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <input type="checkbox" id="notifyLineContent" checked={notifyLine} onChange={e => setNotifyLine(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#22c55e', cursor: 'pointer' }} />
                <label htmlFor="notifyLineContent" style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#15803d', fontWeight: 500 }}>🔔 แจ้งเตือนผ่าน LINE</label>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
              <button type="submit" className="btn btn-primary">บันทึกคอนเท้น</button>
            </div>
          </form>
        )}
      </Modal>

      {/* View Item Modal */}
      {viewItem && (
        <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="รายละเอียด">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {viewItem.itemType === 'task' ? <HiClipboardDocumentList size={24} style={{ color: 'var(--color-text-secondary)' }} /> : <HiDocumentText size={24} style={{ color: 'var(--color-primary)' }} />}
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                {viewItem.company ? <span style={{ color: getCompanyColor(viewItem.company), marginRight: '0.5rem' }}>[{viewItem.company}]</span> : null}
                {viewItem.title}
              </h3>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {viewItem.memberId === 'all' ? <span style={{ fontSize: '1.1rem' }}>👥</span> : <MemberAvatar name={viewItem.member?.name || 'ไม่ระบุ'} size="sm" />}
                <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>{viewItem.memberId === 'all' ? 'ทุกคน' : (viewItem.member?.name || 'ไม่ระบุ')}</span>
              </div>
              <span style={{ backgroundColor: viewItem.status === 'todo' ? '#fffbeb' : viewItem.status === 'in_progress' ? '#eff6ff' : '#ecfdf5', color: viewItem.status === 'todo' ? '#f97316' : viewItem.status === 'in_progress' ? '#3b82f6' : '#10b981', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                {viewItem.status === 'todo' ? 'รอดำเนินการ' : viewItem.status === 'in_progress' ? 'กำลังทำ' : 'เสร็จเรียบร้อย'}
              </span>
              {viewItem.itemType === 'task' && viewItem.priority && (
                <span className={`badge priority-${viewItem.priority}`}>
                  {viewItem.priority === 'high' ? 'ด่วน' : viewItem.priority === 'medium' ? 'ปานกลาง' : 'ต่ำ'}
                </span>
              )}
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', color: '#334155', whiteSpace: 'pre-wrap', border: '1px solid #e2e8f0' }}>
              {viewItem.description || viewItem.platform || 'ไม่มีรายละเอียดเพิ่มเติม'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{viewItem.itemType === 'task' ? 'วันที่เริ่ม' : 'วันที่เผยแพร่'}</span>
                <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                  {viewItem.itemType === 'task' 
                    ? (viewItem.startDate ? formatDateTime(viewItem.startDate) : '-')
                    : (viewItem.publishDate ? formatDateTime(viewItem.publishDate) : '-')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{viewItem.itemType === 'task' ? 'กำหนดส่ง' : 'แพลตฟอร์ม'}</span>
                <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                  {viewItem.itemType === 'task'
                    ? (viewItem.deadline ? formatDateTime(viewItem.deadline) : '-')
                    : (viewItem.platform || '-')}
                </span>
              </div>
            </div>

            {viewItem.link && (
              <div style={{ marginTop: '0.5rem' }}>
                <a href={viewItem.link.startsWith('http') ? viewItem.link : `https://${viewItem.link}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.2rem', height: '1.2rem', marginRight: '0.5rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                  </svg>
                  เปิดลิงก์แนบ
                </a>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
              <button className="btn btn-secondary" onClick={() => setViewItem(null)}>ปิด</button>
              <button className="btn btn-primary" onClick={() => { setViewItem(null); handleEditClick(viewItem); }}>
                <HiOutlinePencilSquare /> แก้ไข
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Modal isOpen={linkErrorOpen} onClose={() => setLinkErrorOpen(false)} title="แจ้งเตือนจากระบบ">
        <div style={{ padding: '1rem 0', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '4rem', height: '4rem', margin: '0 auto' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p style={{ fontSize: '1.15rem', color: 'var(--color-text-primary)', marginBottom: '0.5rem', fontWeight: 600 }}>
            รูปแบบลิงก์ไม่ถูกต้อง
          </p>
          <p style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
            ช่องลิงก์ตรวจสอบงาน ต้องขึ้นต้นด้วย <strong style={{ color: 'var(--color-primary)' }}>http://</strong> หรือ <strong style={{ color: 'var(--color-primary)' }}>https://</strong> เท่านั้นครับ
          </p>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }} onClick={() => setLinkErrorOpen(false)}>
            ตกลง, เข้าใจแล้ว
          </button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={validationAlert.isOpen}
        onClose={() => setValidationAlert({ isOpen: false, item: null })}
        onConfirm={() => {
          const itemToEdit = validationAlert.item;
          setValidationAlert({ isOpen: false, item: null });
          if (itemToEdit) {
            handleEditClick(itemToEdit);
          }
        }}
        title="ข้อมูลไม่ครบถ้วน"
        message={`กรุณาใส่ "ลิงก์ผลงาน" ก่อนเปลี่ยนสถานะเป็น เสร็จสิ้น (เพื่อใช้นับ KPI)`}
        confirmText="ใส่ลิงก์ผลงาน"
        cancelText="ปิด"
        type="warning"
      />

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
