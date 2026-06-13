'use client';

import { useEffect, useState } from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import Modal from '@/components/Modal';

interface TeamMember {
  id: string; name: string; role: string; avatar: string | null; status: string;
}

interface UnifiedItem {
  id: string; title: string; status: string; memberId: string; date: string; type: 'task' | 'content';
  member?: { name: string; avatar: string | null; };
  fullItem?: any;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [membersList, setMembersList] = useState<TeamMember[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);
  const [filterMemberId, setFilterMemberId] = useState('');
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<'task' | 'content'>('content');

  const [taskForm, setTaskForm] = useState({
    title: '', description: '', memberId: '', priority: 'medium', deadline: '', kpiId: '', link: ''
  });
  const [contentForm, setContentForm] = useState({
    title: '', type: 'post', platform: 'Facebook', memberId: '', company: 'GFS', publishDate: '', kpiId: '', link: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resTasks, resContent, resMembers, resKpis] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/content'),
        fetch('/api/members'),
        fetch('/api/kpis')
      ]);
      const tasks = await resTasks.json();
      const contents = await resContent.json();
      const members: TeamMember[] = await resMembers.json();
      const kpisData = await resKpis.json();
      setMembersList(members);
      setKpis(kpisData);

      const unified: UnifiedItem[] = [];
      
      tasks.forEach((t: any) => {
        if (t.deadline) {
          unified.push({
            id: t.id, title: t.title, status: t.status, memberId: t.memberId,
            date: t.deadline.split('T')[0], type: 'task',
            member: members.find(m => m.id === t.memberId),
            fullItem: t
          });
        }
      });

      contents.forEach((c: any) => {
        if (c.publishDate) {
          unified.push({
            id: c.id, title: c.title, status: c.status, memberId: c.memberId,
            date: c.publishDate.split('T')[0], type: 'content',
            member: members.find(m => m.id === c.memberId),
            fullItem: c
          });
        }
      });

      setItems(unified);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCellClick = (dateStr: string) => {
    setIsEditing(false);
    setEditingItemId(null);
    setNewItemType('content');
    setContentForm({
      title: '', type: 'post', platform: 'Facebook', memberId: '', company: 'GFS', publishDate: dateStr, kpiId: '', link: ''
    });
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
        title: item.title || '',
        description: fullItem.description || '',
        memberId: item.memberId || '',
        priority: fullItem.priority || 'medium',
        deadline: item.date || '',
        kpiId: fullItem.kpiId || '',
        link: fullItem.link || ''
      });
    } else {
      const fullItem = item.fullItem || item;
      setContentForm({
        title: item.title || '',
        type: fullItem.type || 'post',
        platform: fullItem.platform || 'Facebook',
        memberId: item.memberId || '',
        company: fullItem.company || 'GFS',
        publishDate: item.date || '',
        kpiId: fullItem.kpiId || '',
        link: fullItem.link || ''
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
      setContentForm({ title: '', type: 'post', platform: 'Facebook', memberId: '', company: 'GFS', publishDate: '', kpiId: '', link: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const daysOfWeek = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const gridCells = [];
  
  // Pad beginning
  for (let i = 0; i < firstDay; i++) {
    gridCells.push(<div key={`empty-start-${i}`} className="calendar-cell empty-cell"></div>);
  }

  // Days
  const todayStr = new Date().toISOString().split('T')[0];
  const filteredItems = filterMemberId ? items.filter(i => i.memberId === filterMemberId) : items;

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayItems = filteredItems.filter(item => item.date === dateStr);
    
    gridCells.push(
      <div 
        key={`day-${i}`} 
        className={`calendar-cell ${dateStr === todayStr ? 'today' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={() => handleCellClick(dateStr)}
      >
        <div className="calendar-date-number">{i}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {dayItems.map(item => (
            <div 
              key={`${item.type}-${item.id}`} 
              className={`calendar-task-item status-${item.status}`} 
              title={`${item.title} (${item.member?.name || 'ไม่ระบุ'})`}
              onClick={(e) => handleItemClick(e, item)}
            >
              {item.member && (
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>
                  {item.member.name.charAt(0)}
                </div>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Pad end to complete the grid (usually 35 or 42 cells total)
  const totalCells = gridCells.length;
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remainingCells; i++) {
    gridCells.push(<div key={`empty-end-${i}`} className="calendar-cell empty-cell"></div>);
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div className="page-header-content">
          <h1>ปฏิทินงาน</h1>
          <p>ดูภาพรวมงานและกำหนดส่งทั้งหมดในแต่ละเดือน</p>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <div className="calendar-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>
              {thaiMonths[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <select 
              className="form-select" 
              style={{ width: '200px', marginLeft: '1rem' }}
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
                {membersList.filter(m => m.status !== 'inactive').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            {taskForm.memberId && kpis.filter(k => k.memberId === taskForm.memberId).length > 0 && (
              <div className="form-group" style={{ backgroundColor: 'var(--color-surface-hover)', padding: '1rem', borderRadius: '8px' }}>
                <label className="form-label" style={{ color: 'var(--color-primary)' }}>เชื่อมโยงกับเป้าหมาย KPI (เพื่ออัปเดตอัตโนมัติ)</label>
                <select className="form-select" value={taskForm.kpiId} onChange={e => setTaskForm({...taskForm, kpiId: e.target.value})}>
                  <option value="">-- ไม่เชื่อมโยง --</option>
                  {kpis.filter(k => k.memberId === taskForm.memberId).sort((a, b) => a.name.length - b.name.length).map(k => (
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
                  <option value="Website">Website</option>
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
                  {membersList.filter(m => m.status !== 'inactive').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            {contentForm.memberId && kpis.filter(k => k.memberId === contentForm.memberId).length > 0 && (
              <div className="form-group" style={{ backgroundColor: 'var(--color-surface-hover)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                <label className="form-label" style={{ color: 'var(--color-primary)' }}>เชื่อมโยงกับเป้าหมาย KPI (เพื่ออัปเดตอัตโนมัติ)</label>
                <select className="form-select" value={contentForm.kpiId} onChange={e => setContentForm({...contentForm, kpiId: e.target.value})}>
                  <option value="">-- ไม่เชื่อมโยง --</option>
                  {kpis.filter(k => k.memberId === contentForm.memberId).sort((a, b) => a.name.length - b.name.length).map(k => (
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
              <button type="submit" className="btn btn-primary">บันทึก</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
