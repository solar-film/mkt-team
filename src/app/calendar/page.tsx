'use client';

import { useEffect, useState } from 'react';
import { HiChevronLeft, HiChevronRight, HiPlus, HiOutlineCalendar } from 'react-icons/hi2';
import Modal from '@/components/Modal';
import MemberAvatar from '@/components/MemberAvatar';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import { getCompanyColor } from '@/lib/colors';

interface TeamMember {
  id: string; name: string; role: string; avatar: string | null; status: string;
}

interface UnifiedItem {
  id: string; title: string; status: string; memberId: string; date: string; type: 'task' | 'content' | 'event';
  startDate?: string;
  member?: { name: string; avatar: string | null; };
  fullItem?: any;
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

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [membersList, setMembersList] = useState<TeamMember[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);
  const [filterMemberId, setFilterMemberId] = useState('');
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<'task' | 'content' | 'event'>('content');

  const [eventForm, setEventForm] = useState({
    title: '', date: '', time: '', type: 'event'
  });

  const [taskForm, setTaskForm] = useState({
    title: '', description: '', memberId: '', priority: 'medium', startDate: '', deadline: '', kpiId: '', link: '', company: ''
  });
  const [contentForm, setContentForm] = useState({
    title: '', description: '', type: '', platform: '', memberId: '', company: '', publishDate: '', kpiId: '', link: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resTasks, resContent, resEvents, resMembers, resKpis] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/content'),
        fetch('/api/events'),
        fetch('/api/members'),
        fetch('/api/kpis')
      ]);
      const tasks = await resTasks.json();
      const contents = await resContent.json();
      const events = await resEvents.json();
      const members: TeamMember[] = await resMembers.json();
      const kpisData = await resKpis.json();
      setMembersList(Array.isArray(members) ? members : []);
      setKpis(Array.isArray(kpisData) ? kpisData : []);

      const unified: UnifiedItem[] = [];
      
      if (Array.isArray(tasks)) {
        tasks.forEach((t: any) => {
          if (t.deadline) {
            unified.push({
              id: t.id, title: t.title, status: t.status, memberId: t.memberId,
              date: t.deadline.split('T')[0], type: 'task',
              startDate: t.startDate ? t.startDate.split('T')[0] : t.deadline.split('T')[0],
              member: Array.isArray(members) ? members.find(m => m.id === t.memberId) : undefined,
              fullItem: t
            });
          }
        });
      }

      if (Array.isArray(contents)) {
        contents.forEach((c: any) => {
          if (c.publishDate) {
            unified.push({
              id: c.id, title: c.title, status: c.status, memberId: c.memberId,
              date: c.publishDate.split('T')[0], type: 'content',
              member: Array.isArray(members) ? members.find(m => m.id === c.memberId) : undefined,
              fullItem: c
            });
          }
        });
      }

      if (Array.isArray(events)) {
        events.forEach((e: any) => {
          if (e.date) {
            unified.push({
              id: e.id, title: e.title, status: 'event', memberId: '',
              date: e.date, type: 'event',
              fullItem: e
            });
          }
        });
      }

      setItems(unified);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setViewMode('week');
    }
    fetchData();
    
    // Auto-refresh data every 2 minutes (120,000 ms)
    const interval = setInterval(() => {
      fetchData();
    }, 120000);
    
    return () => clearInterval(interval);
  }, []);

  const handleCellClick = (dateStr: string) => {
    setIsEditing(false);
    setEditingItemId(null);
    setNewItemType('content');
    setContentForm({
      title: '', description: '', type: '', platform: '', memberId: '', company: '', publishDate: dateStr, kpiId: '', link: ''
    });
    setTaskForm({
      title: '', description: '', memberId: '', priority: 'medium', startDate: '', deadline: dateStr, kpiId: '', link: '', company: ''
    });
    setEventForm({ title: '', date: dateStr, time: '', type: 'event' });
    setIsModalOpen(true);
  };

  const handleItemClick = (e: React.MouseEvent, item: UnifiedItem) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditingItemId(item.id);
    setNewItemType(item.type);
    
    if (item.type === 'task') {
      const fullItem = item.fullItem || item;
      setTaskForm({
        title: fullItem.title,
        description: fullItem.description || '',
        memberId: fullItem.memberId || '',
        priority: fullItem.priority || 'medium',
        startDate: fullItem.startDate ? new Date(fullItem.startDate).toISOString() : '',
        deadline: fullItem.deadline ? new Date(fullItem.deadline).toISOString() : '',
        kpiId: fullItem.kpiId || '',
        link: fullItem.link || '',
        company: fullItem.company || 'GFS'
      });
    } else if (item.type === 'content') {
      const fullItem = item.fullItem || item;
      setContentForm({
        title: item.title || '',
        description: fullItem.description || '',
        type: fullItem.type || 'post',
        platform: fullItem.platform || 'Facebook',
        memberId: item.memberId || '',
        company: fullItem.company || 'GFS',
        publishDate: item.date || '',
        kpiId: fullItem.kpiId || '',
        link: fullItem.link || ''
      });
    } else {
      const fullItem = item.fullItem || item;
      setEventForm({
        title: item.title || '',
        date: item.date || '',
        time: fullItem.time || '',
        type: fullItem.type || 'event'
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
      setTaskForm({ title: '', description: '', memberId: '', priority: 'medium', startDate: '', deadline: '', kpiId: '', link: '', company: '' });
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
        status: isEditing ? undefined : 'todo',
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
      setContentForm({ title: '', description: '', type: '', platform: '', memberId: '', company: '', publishDate: '', kpiId: '', link: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = { ...eventForm };
      
      if (isEditing && editingItemId) {
        await fetch('/api/events', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItemId, ...body })
        });
      } else {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }
      setIsModalOpen(false);
      setEventForm({ title: '', date: '', time: '', type: 'event' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('ยืนยันการลบกิจกรรม/แจ้งเตือนนี้?')) return;
    try {
      await fetch(`/api/events?id=${id}`, { method: 'DELETE' });
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Desktop Calendar Grid Logic ---
  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const daysOfWeek = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const gridCells = [];
  for (let i = 0; i < firstDay; i++) {
    gridCells.push(<div key={`empty-start-${i}`} className="calendar-cell empty-cell"></div>);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const filteredItems = filterMemberId ? items.filter(i => i.memberId === filterMemberId) : items;

  // 1. Sort items globally
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.type === 'event' && b.type !== 'event') return -1;
    if (a.type !== 'event' && b.type === 'event') return 1;
    
    const startA = new Date((a.startDate || a.date) + 'T00:00:00').getTime();
    const startB = new Date((b.startDate || b.date) + 'T00:00:00').getTime();
    if (startA !== startB) return startA - startB;
    const endA = new Date(a.date + 'T00:00:00').getTime();
    const endB = new Date(b.date + 'T00:00:00').getTime();
    return (endB - startB) - (endA - startA); // Longest first
  });

  // 2. Assign rows to prevent overlap
  const occupied: Record<string, boolean[]> = {};
  const itemRows = new Map<string, number>();

  sortedItems.forEach(item => {
    const startD = new Date((item.startDate || item.date) + 'T00:00:00');
    const endD = new Date(item.date + 'T00:00:00');
    
    let row = 0;
    while (true) {
      let isFree = true;
      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (occupied[dStr] && occupied[dStr][row]) {
          isFree = false;
          break;
        }
      }
      if (isFree) break;
      row++;
    }
    
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!occupied[dStr]) occupied[dStr] = [];
      occupied[dStr][row] = true;
    }
    itemRows.set(item.id, row);
  });

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    
    const dayItemsRaw = sortedItems.filter(item => {
      const start = item.startDate || item.date;
      const end = item.date;
      return dateStr >= start && dateStr <= end;
    });

    const maxRow = dayItemsRaw.reduce((max, item) => Math.max(max, itemRows.get(item.id) || 0), -1);
    const daySlots: (UnifiedItem | null)[] = Array(maxRow + 1).fill(null);
    dayItemsRaw.forEach(item => {
      daySlots[itemRows.get(item.id) || 0] = item;
    });
    
    gridCells.push(
      <div 
        key={`day-${i}`} 
        className={`calendar-cell ${dateStr === todayStr ? 'today' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={() => handleCellClick(dateStr)}
      >
        <div className="calendar-date-number">{i}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {daySlots.map((item, index) => {
            if (!item) {
              return <div key={`empty-${dateStr}-${index}`} style={{ height: '28px' }}></div>;
            }
            
            const start = item.startDate || item.date;
            const end = item.date;
            const isStart = dateStr === start;
            const isEnd = dateStr === end;
            let spanClass = '';
            if (start !== end) {
              if (isStart) spanClass = 'task-span-start';
              else if (isEnd) spanClass = 'task-span-end';
              else spanClass = 'task-span-middle';
            }
            
            let bgColor = 'white';
            let borderColor = 'var(--color-border)';
            let textColor = 'inherit';
            if (item.type !== 'event') {
              if (item.status === 'todo') { bgColor = '#fffbeb'; borderColor = '#f97316'; textColor = '#ea580c'; }
              else if (item.status === 'in_progress') { bgColor = '#eff6ff'; borderColor = '#3b82f6'; textColor = '#1d4ed8'; }
              else if (item.status === 'done') { bgColor = '#ecfdf5'; borderColor = '#10b981'; textColor = '#047857'; }
            }

            return (
            <div 
              key={`${item.type}-${item.id}`} 
              className={item.type === 'event' ? 'calendar-task-item status-event' : `calendar-task-item status-${item.status} ${spanClass}`} 
              title={item.type === 'event' ? `${item.fullItem?.time ? item.fullItem.time + ' - ' : ''}${item.title}` : `${item.fullItem?.company ? `[${item.fullItem.company}] ` : ''}${item.title} (${item.member?.name || 'ไม่ระบุ'})`}
              onClick={(e) => handleItemClick(e, item)}
              style={item.type === 'event' 
                ? { backgroundColor: '#fce7f3', borderColor: '#ec4899', color: '#be185d', fontWeight: 600, height: '28px' } 
                : { backgroundColor: bgColor, borderColor: borderColor, color: textColor, fontWeight: 600, height: '28px' }}
              >
              {item.type === 'event' && <span style={{ marginRight: '4px' }}>📢</span>}
              {item.type !== 'event' && item.member && (spanClass === '' || spanClass === 'task-span-start') && (
                <MemberAvatar name={item.member.name} size="sm" />
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, display: 'block' }}>
                {item.type === 'event' && item.fullItem?.time ? <span style={{ marginRight: '4px', opacity: 0.8 }}>{item.fullItem.time}</span> : null}
                {(spanClass === '' || spanClass === 'task-span-start') ? item.title : '\u00A0'}
              </span>
            </div>
          )})}
        </div>
      </div>
    );
  }

  const totalCells = gridCells.length;
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remainingCells; i++) {
    gridCells.push(<div key={`empty-end-${i}`} className="calendar-cell empty-cell"></div>);
  }

  // --- Mobile Calendar Slider Logic ---
  const getWeekDays = (date: Date) => {
    const current = new Date(date);
    const week = [];
    current.setDate((current.getDate() - current.getDay())); 
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return week;
  };

  const mobileWeekDays = getWeekDays(currentDate);
  const thaiShortDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  const handleMobilePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleMobileNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const mobileDayItems = filteredItems.filter(item => {
    const start = item.startDate || item.date;
    const end = item.date;
    return selectedDateStr >= start && selectedDateStr <= end;
  }).sort((a, b) => {
    if (a.type === 'event' && b.type !== 'event') return -1;
    if (a.type !== 'event' && b.type === 'event') return 1;
    
    const getTimeVal = (item: UnifiedItem) => {
      if (item.type === 'event') {
        if (!item.fullItem?.time) return 9999;
        const [h, m] = item.fullItem.time.split(':');
        return parseInt(h) * 60 + parseInt(m);
      }
      const dateStr = item.type === 'task' ? item.fullItem?.deadline : item.fullItem?.publishDate;
      if (!dateStr || !dateStr.includes('T')) return 9999;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 9999;
      return d.getHours() * 60 + d.getMinutes();
    };
    
    const timeA = getTimeVal(a);
    const timeB = getTimeVal(b);
    if (timeA !== timeB) return timeA - timeB;
    return a.title.localeCompare(b.title);
  });

  return (
    <div>
      {/* -------------------- DESKTOP VIEW -------------------- */}
      <div className="desktop-only">
        <div className="page-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="page-header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h1 style={{ margin: 0 }}>ปฏิทินงาน</h1>
              <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '0.25rem' }}>
                <button 
                  style={{ padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', border: 'none', background: viewMode === 'month' ? '#ffffff' : 'transparent', color: viewMode === 'month' ? '#0f172a' : '#64748b', boxShadow: viewMode === 'month' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', fontWeight: viewMode === 'month' ? 600 : 400 }}
                  onClick={() => setViewMode('month')}
                >
                  รายเดือน
                </button>
                <button 
                  style={{ padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', border: 'none', background: viewMode === 'week' ? '#ffffff' : 'transparent', color: viewMode === 'week' ? '#0f172a' : '#64748b', boxShadow: viewMode === 'week' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', fontWeight: viewMode === 'week' ? 600 : 400 }}
                  onClick={() => setViewMode('week')}
                >
                  รายสัปดาห์
                </button>
              </div>
            </div>
            <p>ภาพรวมงานและคอนเทนต์ทั้งหมดของทีม</p>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div className="calendar-controls">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                {thaiMonths[currentDate.getMonth()]} {currentDate.getFullYear() + 543}
              </h2>
              <select 
                className="form-select" 
                style={{ minWidth: '180px', flex: 1, maxWidth: '300px' }}
                value={filterMemberId}
                onChange={(e) => setFilterMemberId(e.target.value)}
              >
                <option value="">-- พนักงานทั้งหมด --</option>
                {membersList.filter(m => m.status !== 'inactive').map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={prevMonth}>
                <HiChevronLeft />
              </button>
              <button className="btn btn-secondary" onClick={() => setCurrentDate(new Date())}>
                เดือนนี้
              </button>
              <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={nextMonth}>
                <HiChevronRight />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-container" style={{ minHeight: '400px' }}><div className="loading-spinner"></div></div>
          ) : viewMode === 'week' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {mobileWeekDays.map((day, i) => {
                  const isSelected = day.toDateString() === selectedDate.toDateString();
                  const isToday = day.toDateString() === new Date().toDateString();
                  const hasItems = filteredItems.some(item => {
                    const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                    const start = item.startDate || item.date;
                    const end = item.date;
                    return dayStr >= start && dayStr <= end;
                  });
                  return (
                    <div key={i} onClick={() => setSelectedDate(day)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '0.5rem', flex: 1 }}>
                      <span style={{ fontSize: '0.85rem', color: isSelected ? '#3b82f6' : '#64748b', fontWeight: isSelected ? 600 : 500 }}>{daysOfWeek[i]}</span>
                      <div style={{ 
                        width: '40px', height: '40px', borderRadius: '50%', 
                        backgroundColor: isSelected ? '#3b82f6' : 'transparent', 
                        color: isSelected ? '#ffffff' : (isToday ? '#f97316' : '#1e293b'),
                        fontWeight: isSelected || isToday ? 700 : 500,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', position: 'relative'
                      }}>
                        {day.getDate()}
                        {hasItems && !isSelected && <div style={{ position: 'absolute', bottom: '2px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f97316' }}></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: 0, marginBottom: '0.5rem' }}>งานประจำวันที่ {selectedDate.getDate()} {thaiMonths[selectedDate.getMonth()]} {selectedDate.getFullYear() + 543}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                  {mobileDayItems.length > 0 && <div style={{ position: 'absolute', left: '19px', top: '20px', bottom: '20px', width: '2px', backgroundColor: '#e2e8f0', zIndex: 0 }}></div>}
                  {mobileDayItems.map((item, index) => {
                    if (item.type === 'event') {
                      return (
                        <div key={`event-${item.id}`} onClick={(e) => handleItemClick(e, item)} style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 1, cursor: 'pointer' }}>
                          <div style={{ width: '40px', fontSize: '0.8rem', fontWeight: 600, color: '#ec4899', paddingTop: '0.75rem', textAlign: 'right' }}>
                            {item.fullItem?.time || '-'}
                          </div>
                          <div style={{ flex: 1, backgroundColor: '#fce7f3', borderLeft: `4px solid #ec4899`, borderRadius: '0 12px 12px 0', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                            <div>
                              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#be185d' }}>📢 {item.title}</h4>
                              <span style={{ fontSize: '0.75rem', color: '#be185d', opacity: 0.8 }}>กิจกรรม / แจ้งให้ทราบ</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const isContent = item.type === 'content';
                    const dateStr = item.type === 'task' ? item.fullItem?.deadline : item.fullItem?.publishDate;
                    let timeStr = '-';
                    if (dateStr && dateStr.includes('T')) {
                      const d = new Date(dateStr);
                      if (!isNaN(d.getTime())) {
                        const h = d.getHours().toString().padStart(2, '0');
                        const m = d.getMinutes().toString().padStart(2, '0');
                        if (h !== '00' || m !== '00') timeStr = `${h}:${m}`;
                      }
                    }
                    
                    let borderColor = '#3b82f6';
                    let bgColor = '#f0f9ff';
                    if (item.status === 'todo') { borderColor = '#f97316'; bgColor = '#fffbeb'; }
                    else if (item.status === 'in_progress') { borderColor = '#3b82f6'; bgColor = '#eff6ff'; }
                    else if (item.status === 'done') { borderColor = '#10b981'; bgColor = '#ecfdf5'; }
                    
                    return (
                      <div key={item.id} onClick={(e) => handleItemClick(e, item)} style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 1, cursor: 'pointer' }}>
                        <div style={{ width: '40px', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', paddingTop: '0.75rem', textAlign: 'right' }}>
                          {timeStr}
                        </div>
                        <div style={{ flex: 1, backgroundColor: bgColor, borderLeft: `4px solid ${borderColor}`, borderRadius: '0 12px 12px 0', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                          <div>
                            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 600, color: borderColor }}>
                              {item.fullItem?.company ? <span style={{ color: getCompanyColor(item.fullItem.company), marginRight: '4px' }}>[{item.fullItem.company}]</span> : null}{item.title}
                            </h4>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {item.type === 'task' ? item.fullItem?.description || 'ไม่มีรายละเอียด' : `${item.fullItem?.type} - ${item.fullItem?.platform}`}
                            </span>
                          </div>
                          {item.member && (
                            <div style={{ flexShrink: 0 }}>
                              <MemberAvatar name={item.member.name} size="sm" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {mobileDayItems.length === 0 && (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8' }}>ไม่มีงานในวันนี้</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
              <div className="calendar-grid" style={{ minWidth: '800px' }}>
                {daysOfWeek.map(day => (
                  <div key={day} className="calendar-header-cell">{day}</div>
                ))}
                {gridCells}
              </div>
            </div>
          )}
          
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }}></div>
              <span>เสร็จแล้ว</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--color-warning)' }}></div>
              <span>กำลังทำ</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--color-border)' }}></div>
              <span>รอดำเนินการ</span>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------- MOBILE VIEW -------------------- */}
      <div className="mobile-only" style={{ paddingBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>ปฏิทินงาน</h1>
          <button 
            onClick={() => handleCellClick(selectedDateStr)}
            style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
          >
            <HiPlus /> เพิ่มกิจกรรม
          </button>
        </div>

        {/* Calendar Slider */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '1rem', marginBottom: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <button onClick={handleMobilePrevWeek} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><HiChevronLeft size={20} /></button>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#1e293b' }}>
              {thaiMonths[currentDate.getMonth()]} {currentDate.getFullYear() + 543}
            </h2>
            <button onClick={handleMobileNextWeek} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><HiChevronRight size={20} /></button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {mobileWeekDays.map((day, i) => {
              const isSelected = day.toDateString() === selectedDate.toDateString();
              const isToday = day.toDateString() === new Date().toDateString();
              const hasItems = filteredItems.some(item => {
                const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                const start = item.startDate || item.date;
                const end = item.date;
                return dayStr >= start && dayStr <= end;
              });
              
              return (
                <div key={i} onClick={() => setSelectedDate(day)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: isSelected ? '#3b82f6' : '#94a3b8', fontWeight: isSelected ? 600 : 400 }}>{thaiShortDays[i]}</span>
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', 
                    backgroundColor: isSelected ? '#3b82f6' : 'transparent', 
                    color: isSelected ? '#ffffff' : (isToday ? '#f97316' : '#1e293b'),
                    fontWeight: isSelected || isToday ? 700 : 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.9rem',
                    position: 'relative'
                  }}>
                    {day.getDate()}
                    {hasItems && !isSelected && <div style={{ position: 'absolute', bottom: '2px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#f97316' }}></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agenda List */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#1e293b' }}>
            {selectedDate.getDate()} {thaiMonths[selectedDate.getMonth()]} {selectedDate.getFullYear() + 543}
          </h3>
          
          {loading ? (
             <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
               <div className="loading-spinner"></div>
             </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
              {mobileDayItems.length > 0 && <div style={{ position: 'absolute', left: '19px', top: '20px', bottom: '20px', width: '2px', backgroundColor: '#e2e8f0', zIndex: 0 }}></div>}
              
              {mobileDayItems.map((item, index) => {
                if (item.type === 'event') {
                  return (
                    <div key={`event-${item.id}`} onClick={(e) => handleItemClick(e, item)} style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 1, cursor: 'pointer' }}>
                      <div style={{ width: '40px', fontSize: '0.8rem', fontWeight: 600, color: '#ec4899', paddingTop: '0.75rem', textAlign: 'right' }}>
                        {item.fullItem?.time || '-'}
                      </div>
                      <div style={{ flex: 1, backgroundColor: '#fce7f3', borderLeft: `4px solid #ec4899`, borderRadius: '0 12px 12px 0', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                        <div>
                          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#be185d' }}>📢 {item.title}</h4>
                          <span style={{ fontSize: '0.75rem', color: '#be185d', opacity: 0.8 }}>กิจกรรม / แจ้งให้ทราบ</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                const isContent = item.type === 'content';
                const dateStr = item.type === 'task' ? item.fullItem?.deadline : item.fullItem?.publishDate;
                let timeStr = '-';
                if (dateStr && dateStr.includes('T')) {
                  const d = new Date(dateStr);
                  if (!isNaN(d.getTime())) {
                    const h = d.getHours().toString().padStart(2, '0');
                    const m = d.getMinutes().toString().padStart(2, '0');
                    if (h !== '00' || m !== '00') timeStr = `${h}:${m}`;
                  }
                }
                
                // Color mapping based on status
                let borderColor = '#3b82f6';
                let bgColor = '#f0f9ff';
                if (item.status === 'todo') { borderColor = '#f97316'; bgColor = '#fffbeb'; }
                else if (item.status === 'in_progress') { borderColor = '#3b82f6'; bgColor = '#eff6ff'; }
                else if (item.status === 'done') { borderColor = '#10b981'; bgColor = '#ecfdf5'; }
                
                return (
                  <div key={item.id} onClick={(e) => handleItemClick(e, item)} style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 1, cursor: 'pointer' }}>
                    <div style={{ width: '40px', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', paddingTop: '0.75rem', textAlign: 'right' }}>
                      {timeStr}
                    </div>
                    <div style={{ flex: 1, backgroundColor: bgColor, borderLeft: `4px solid ${borderColor}`, borderRadius: '0 12px 12px 0', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 600, color: borderColor }}>
                          {item.fullItem?.company ? <span style={{ color: getCompanyColor(item.fullItem.company), marginRight: '4px' }}>[{item.fullItem.company}]</span> : null}{item.title}
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {item.type === 'task' ? item.fullItem?.description || 'งานทั่วไป' : `${item.fullItem?.type} - ${item.fullItem?.platform}`}
                        </span>
                      </div>
                      {item.member && (
                        <div style={{ flexShrink: 0 }}>
                          <MemberAvatar name={item.member.name} size="sm" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {mobileDayItems.length === 0 && (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                  <HiOutlineCalendar size={32} style={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>ไม่มีงานหรือกิจกรรมในวันนี้</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- Shared Modal --- */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? (newItemType === 'task' ? "แก้ไขงาน" : newItemType === 'content' ? "แก้ไขคอนเท้น" : "แก้ไขกิจกรรม/ประกาศ") : "เพิ่มรายการใหม่"}>
        {!isEditing && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button type="button" className={`btn ${newItemType === 'content' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setNewItemType('content')} style={{ flex: 1 }}>คอนเท้น</button>
            <button type="button" className={`btn ${newItemType === 'task' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setNewItemType('task')} style={{ flex: 1 }}>งานทั่วไป</button>
            <button type="button" className={`btn ${newItemType === 'event' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setNewItemType('event')} style={{ flex: 1 }}>แจ้งเตือน</button>
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
              <input type="text" className="form-input" placeholder="เช่น https://docs.google.com/..." value={taskForm.link} onChange={e => setTaskForm({...taskForm, link: e.target.value})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">ผู้รับผิดชอบ *</label>
                <select className="form-select" required value={taskForm.memberId} onChange={e => setTaskForm({...taskForm, memberId: e.target.value, kpiId: ''})}>
                  <option value="">-- เลือกผู้รับผิดชอบ --</option>
                  {membersList.filter(m => m.status !== 'inactive').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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
            {/* KPI selection removed from tasks as per user request */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
              <button type="submit" className="btn btn-primary">บันทึกงาน</button>
            </div>
          </form>
        ) : newItemType === 'content' ? (
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
                  {membersList.filter(m => m.status !== 'inactive').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
              {isEditing && editingItemId ? (
                <button type="button" className="btn btn-danger" onClick={() => {
                  if (confirm('ยืนยันการลบคอนเท้นนี้?')) {
                    fetch(`/api/content?id=${editingItemId}`, { method: 'DELETE' }).then(() => {
                      setIsModalOpen(false); fetchData();
                    });
                  }
                }}>ลบคอนเท้น</button>
              ) : <div></div>}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">บันทึก</button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleEventSubmit}>
            <div className="form-group">
              <label className="form-label">ชื่อกิจกรรม / เรื่องที่แจ้งให้ทราบ *</label>
              <input type="text" className="form-input" required placeholder="เช่น วันนี้ประชุม 10 โมง" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">วันที่ *</label>
                <DatePicker 
                  selected={eventForm.date ? new Date(eventForm.date) : null} 
                  onChange={(date: Date | null) => setEventForm({...eventForm, date: date ? format(date, 'yyyy-MM-dd') : ''})} 
                  dateFormat="dd/MM/yyyy" 
                  className="form-input" 
                  placeholderText="วว/ดด/ปปปป"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">เวลา (ถ้ามี)</label>
                <input type="time" className="form-input" value={eventForm.time} onChange={e => setEventForm({...eventForm, time: e.target.value})} />
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
              {isEditing && editingItemId ? (
                <button type="button" className="btn btn-danger" onClick={() => handleDeleteEvent(editingItemId)}>ลบกิจกรรม</button>
              ) : <div></div>}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#f59e0b' }}>บันทึกกิจกรรม</button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
