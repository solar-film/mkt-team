'use client';

import { useEffect, useState } from 'react';
import {
  HiPlus,
  HiOutlineTrash,
  HiPencilSquare,
  HiCheckCircle,
  HiClock,
  HiCalendarDays,
  HiUserGroup,
  HiClipboardDocumentList,
  HiChevronDown,
  HiChevronUp,
  HiXMark,
  HiArrowPath,
} from 'react-icons/hi2';
import Modal from '@/components/Modal';
import ConfirmModal from '@/components/ConfirmModal';
import MemberAvatar from '@/components/MemberAvatar';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

interface MeetingLinkedItem {
  id: string;
  title: string;
  status: string;
  memberId: string;
  deadline?: string;
  publishDate?: string;
  meetingId: string;
  company?: string;
  itemCategory: 'task' | 'content';
  member?: {
    id: string;
    name: string;
    role?: string;
  };
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  attendees: string;
  attendeeNames?: string[];
  agenda: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status?: string;
}

interface ItemForm {
  title: string;
  itemCategory: 'task' | 'content';
  company: string;
  memberId: string;
  deadline: string;
  isNew?: boolean;
  id?: string;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string) {
  if (!timeStr) return '';
  return timeStr;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingItems, setMeetingItems] = useState<Record<string, MeetingLinkedItem[]>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState({
    title: '',
    date: '',
    time: '',
    attendees: [] as string[],
    agenda: '',
    notes: '',
    createdBy: '',
  });

  // Action Items in form
  const [formItems, setFormItems] = useState<ItemForm[]>([]);
  
  // Custom external attendees
  const [customAttendee, setCustomAttendee] = useState('');

  const addCustomAttendee = () => {
    if (customAttendee.trim() && !form.attendees.includes(customAttendee.trim())) {
      setForm(prev => ({
        ...prev,
        attendees: [...prev.attendees, customAttendee.trim()],
      }));
      setCustomAttendee('');
    }
  };

  const fetchMeetings = async () => {
    try {
      const [meetingsRes, membersRes] = await Promise.all([
        fetch('/api/meetings', { cache: 'no-store' }),
        fetch('/api/members', { cache: 'no-store' }),
      ]);
      const meetingsData = await meetingsRes.json();
      const membersData = await membersRes.json();
      
      if (Array.isArray(meetingsData)) {
        setMeetings(meetingsData);
        const newItems: Record<string, MeetingLinkedItem[]> = {};
        meetingsData.forEach((m: any) => {
          const tasks = (m.tasks || []).map((t: any) => ({ ...t, itemCategory: 'task' }));
          const contents = (m.contents || []).map((c: any) => ({ ...c, itemCategory: 'content' }));
          const allItems = [...tasks, ...contents].sort((a, b) => {
            const dateA = new Date(a.deadline || a.publishDate || a.createdAt || 0).getTime();
            const dateB = new Date(b.deadline || b.publishDate || b.createdAt || 0).getTime();
            return dateA - dateB;
          });
          newItems[m.id] = allItems;
        });
        setMeetingItems(newItems);
      } else {
        setMeetings([]);
      }
      setMembers(Array.isArray(membersData) ? membersData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleCopySummary = (meeting: Meeting, items: MeetingLinkedItem[]) => {
    const grouped: Record<string, MeetingLinkedItem[]> = {};
    items.forEach(item => {
      const role = item.member?.role || 'ทั่วไป';
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(item);
    });

    const mDate = formatDate(meeting.date.split('T')[0]);
    let text = `สรุปรายการสิ่งที่ต้องทำ (To-Do List)\nจากการประชุม: ${meeting.title} (${mDate})\n\nโดยแบ่งตามส่วนงานเพื่อนำไปลงตารางปฏิบัติงานต่อได้ทันทีครับ\n\n`;

    Object.entries(grouped).forEach(([role, roleItems]) => {
      let emoji = '📌';
      if (role.toLowerCase().includes('marketing') || role.includes('การตลาด')) emoji = '🎯';
      else if (role.toLowerCase().includes('business') || role.includes('พัฒนาธุรกิจ')) emoji = '🔍';
      else if (role.toLowerCase().includes('design') || role.includes('ดีไซน์')) emoji = '🎨';
      else if (role.toLowerCase().includes('web') || role.includes('เว็บไซต์')) emoji = '🌐';
      else if (role.toLowerCase().includes('video') || role.includes('วีดีโอ') || role.toLowerCase().includes('production') || role.includes('ช่างภาพ')) emoji = '🎬';

      text += `${emoji} ${role}\n`;
      roleItems.forEach(item => {
        const companyStr = item.company ? `${item.company}: ` : '';
        text += `o [ ] ${companyStr}${item.title}\n`;
      });
      text += '\n';
    });

    navigator.clipboard.writeText(text).then(() => {
      // Show inline success message
      setCopiedId(items[0]?.meetingId || 'success');
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      // Fallback to alert only on error
      alert('เกิดข้อผิดพลาดในการคัดลอก กรุณาลองใหม่อีกครั้ง');
    });
  };

  const resetForm = () => {
    setForm({ title: '', date: '', time: '', attendees: [], agenda: '', notes: '', createdBy: '' });
    setFormItems([]);
    setIsEditing(false);
    setEditingId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (meeting: Meeting) => {
    setForm({
      title: meeting.title,
      date: meeting.date ? meeting.date.split('T')[0] : '',
      time: meeting.time || '',
      attendees: meeting.attendees ? meeting.attendees.split(',').filter(Boolean) : [],
      agenda: meeting.agenda || '',
      notes: meeting.notes || '',
      createdBy: meeting.createdBy || '',
    });
    setIsEditing(true);
    setEditingId(meeting.id);
    // Load existing items for editing
    if (meetingItems[meeting.id]) {
      setFormItems(meetingItems[meeting.id].map(item => ({
        id: item.id,
        title: item.title,
        itemCategory: item.itemCategory,
        company: item.company || 'GFS',
        memberId: item.memberId || '',
        deadline: (item.itemCategory === 'task' ? item.deadline : item.publishDate)?.split('T')[0] || '',
      })));
    } else {
      setFormItems([]);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        ...form,
        attendees: form.attendees.join(','),
      };

      let newMeetingId = editingId;

      if (isEditing && editingId) {
        await fetch('/api/meetings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...body }),
        });
      } else {
        const res = await fetch('/api/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const created = await res.json();
        newMeetingId = created.id;
      }

      // Create Task/Content for each action item
      if (newMeetingId && formItems.length > 0) {
        for (const item of formItems.filter(i => i.title.trim())) {
          
          if (item.itemCategory === 'task') {
            const payload = {
              title: item.title,
              memberId: item.memberId,
              deadline: item.deadline,
              meetingId: newMeetingId,
              status: 'todo',
              priority: 'medium',
              company: item.company,
            };
            
            if (isEditing && item.id && !item.isNew) {
              await fetch('/api/tasks', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, ...payload }),
              });
            } else if (item.isNew || !isEditing) {
              await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
            }
          } else {
            const payload = {
              title: item.title,
              memberId: item.memberId,
              publishDate: item.deadline,
              meetingId: newMeetingId,
              status: 'draft',
              platform: 'Facebook',
              type: 'post',
              company: item.company,
            };
            
            if (isEditing && item.id && !item.isNew) {
              await fetch('/api/content', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, ...payload }),
              });
            } else if (item.isNew || !isEditing) {
              await fetch('/api/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
            }
          }
        }
      }

      setIsModalOpen(false);
      resetForm();
      setLoading(true);
      fetchMeetings();
      // Clear cached items so they reload
      setMeetingItems({});
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await fetch(`/api/meetings?id=${deleteId}`, { method: 'DELETE' });
      setDeleteId(null);
      fetchMeetings();
      setMeetingItems(prev => {
        const next = { ...prev };
        delete next[deleteId];
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleItemStatus = async (item: MeetingLinkedItem) => {
    const isTask = item.itemCategory === 'task';
    const newStatus = isTask 
      ? (item.status === 'done' ? 'todo' : 'done')
      : (item.status === 'published' ? 'draft' : 'published');
      
    try {
      await fetch(isTask ? '/api/tasks' : '/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: newStatus }),
      });
      // Update locally
      setMeetingItems(prev => ({
        ...prev,
        [item.meetingId]: (prev[item.meetingId] || []).map(i =>
          i.id === item.id ? { ...i, status: newStatus } : i
        ),
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const addFormItem = () => {
    setFormItems([...formItems, { title: '', itemCategory: 'task', company: 'GFS', memberId: '', deadline: '', isNew: true }]);
  };

  const removeFormItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const updateFormItem = (index: number, field: keyof ItemForm, value: string) => {
    setFormItems(formItems.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const toggleAttendee = (memberId: string) => {
    setForm(prev => ({
      ...prev,
      attendees: prev.attendees.includes(memberId)
        ? prev.attendees.filter(id => id !== memberId)
        : [...prev.attendees, memberId],
    }));
  };

  const activeMembers = members.filter(m => m.status !== 'inactive');

  if (loading) return <div className="loading-container"><div className="loading-spinner"></div></div>;

  return (
    <div style={{ padding: '0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            📋 บันทึกการประชุม
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            จัดการวาระประชุม, สิ่งที่ต้องทำ และสิ่งที่ต้องติดตาม
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <HiPlus /> สร้างบันทึกประชุม
        </button>
      </div>

      {/* Meeting List */}
      {meetings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-secondary)' }}>
          <HiClipboardDocumentList style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ fontSize: '1rem' }}>ยังไม่มีบันทึกการประชุม</p>
          <p style={{ fontSize: '0.85rem' }}>กดปุ่ม "สร้างบันทึกประชุม" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="timeline-container">
          {meetings.map(meeting => {
            const items = meetingItems[meeting.id] || [];
            const doneCount = items.filter(i => (i.itemCategory === 'task' ? i.status === 'done' : i.status === 'published')).length;
            const totalCount = items.length;

            return (
              <div key={meeting.id} className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-card">
                  {/* Card Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    {/* Date badge */}
                    <div style={{
                      minWidth: '52px',
                      textAlign: 'center',
                      backgroundColor: '#eff6ff',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.5rem 0.6rem',
                      flexShrink: 0,
                    }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase' }}>
                        {meeting.date ? new Date(meeting.date).toLocaleDateString('th-TH', { month: 'short' }) : '-'}
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e40af', lineHeight: 1 }}>
                        {meeting.date ? new Date(meeting.date).getDate() : '-'}
                      </div>
                    </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {meeting.title}
                      </h3>
                      {meeting.time && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                          <HiClock style={{ fontSize: '0.8rem' }} /> {formatTime(meeting.time)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                      {/* Attendee names */}
                      {meeting.attendeeNames && meeting.attendeeNames.length > 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                          <span style={{ fontWeight: 500, marginRight: '0.3rem' }}>ผู้เข้าร่วม:</span>
                          {meeting.attendeeNames.join(', ')}
                        </div>
                      )}
                      {/* Items progress */}
                      {totalCount > 0 && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: doneCount === totalCount ? '#10b981' : '#f59e0b',
                          backgroundColor: doneCount === totalCount ? '#ecfdf5' : '#fffbeb',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}>
                          {doneCount === totalCount ? <HiCheckCircle /> : <HiClock />}
                          {doneCount}/{totalCount} รายการ
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      className="btn btn-icon btn-sm"
                      style={{ color: 'var(--color-primary)', backgroundColor: 'transparent' }}
                      onClick={(e) => { e.stopPropagation(); openEditModal(meeting); }}
                      title="แก้ไข"
                    >
                      <HiPencilSquare />
                    </button>
                    <button
                      className="btn btn-icon btn-sm"
                      style={{ color: 'var(--color-danger)', backgroundColor: 'transparent' }}
                      onClick={(e) => { e.stopPropagation(); setDeleteId(meeting.id); setIsConfirmOpen(true); }}
                      title="ลบ"
                    >
                      <HiOutlineTrash />
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                <div style={{ padding: '0 1.5rem 1.5rem', borderTop: '1px solid var(--color-border)' }}>
                        {/* Agenda */}
                        {meeting.agenda && (
                          <div style={{ marginTop: '1rem' }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              📌 วาระการประชุม
                            </h4>
                            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6, backgroundColor: 'var(--color-surface-hover)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
                              {meeting.agenda}
                            </p>
                          </div>
                        )}

                        {/* Notes */}
                        {meeting.notes && (
                          <div style={{ marginTop: '1rem' }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              📝 สรุปการประชุม
                            </h4>
                            <div 
                              className="meeting-notes-content"
                              style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', lineHeight: 1.6, backgroundColor: 'var(--color-surface-hover)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}
                              dangerouslySetInnerHTML={{ __html: meeting.notes }}
                            />
                          </div>
                        )}

                        {/* Action Items (Tasks) */}
                        {items.length > 0 && (
                          <div style={{ marginTop: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                ⚡ งานที่เกี่ยวข้อง ({doneCount}/{totalCount})
                              </h4>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={(e) => { e.stopPropagation(); handleCopySummary(meeting, items); }}
                                style={{
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: copiedId === meeting.id ? '#ecfdf5' : '#fef3c7',
                                  color: copiedId === meeting.id ? '#10b981' : '#d97706',
                                  border: `1px solid ${copiedId === meeting.id ? '#a7f3d0' : '#fde68a'}`,
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                {copiedId === meeting.id ? (
                                  <>
                                    <HiCheckCircle /> คัดลอกเรียบร้อย!
                                  </>
                                ) : (
                                  <>
                                    <HiClipboardDocumentList /> คัดลอก To-Do List
                                  </>
                                )}
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {items.map(item => {
                                const isDone = item.itemCategory === 'task' ? item.status === 'done' : item.status === 'published';
                                return (
                                <div
                                  key={item.id}
                                  onClick={() => toggleItemStatus(item)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.6rem 0.75rem',
                                    backgroundColor: isDone ? '#f0fdf4' : '#ffffff',
                                    border: `1px solid ${isDone ? '#bbf7d0' : '#e2e8f0'}`,
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    transition: 'all var(--transition-fast)',
                                  }}
                                >
                                  <div style={{
                                    width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                                    border: isDone ? 'none' : '2px solid #cbd5e1',
                                    backgroundColor: isDone ? '#10b981' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                    {isDone && (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    )}
                                  </div>
                                  <span style={{
                                    flex: 1,
                                    fontSize: '0.875rem',
                                    color: isDone ? '#6b7280' : 'var(--color-text-primary)',
                                    textDecoration: isDone ? 'line-through' : 'none',
                                  }}>
                                    <span style={{ fontSize: '0.7rem', backgroundColor: '#e2e8f0', padding: '0.1rem 0.3rem', borderRadius: '4px', marginRight: '0.4rem', color: '#475569' }}>{item.itemCategory === 'content' ? 'คอนเทนต์' : 'ทั่วไป'}</span>
                                    {item.title}
                                  </span>
                                  {item.member && (
                                    <MemberAvatar name={item.member.name} size="sm" />
                                  )}
                                  {(item.deadline || item.publishDate) && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                                      📅 {formatDate(item.deadline || item.publishDate || '')}
                                    </span>
                                  )}
                                </div>
                              )})}
                            </div>
                          </div>
                        )}

                        {items.length === 0 && (
                          <div style={{ marginTop: '1rem', textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                            ไม่มีงานที่เกี่ยวข้อง
                          </div>
                        )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'แก้ไขบันทึกประชุม' : 'สร้างบันทึกประชุมใหม่'} maxWidth="800px">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">หัวข้อการประชุม *</label>
            <input
              type="text"
              className="form-input"
              required
              placeholder="เช่น ประชุมวางแผนคอนเท้นประจำสัปดาห์"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">วันที่ *</label>
              <input
                type="date"
                className="form-input"
                required
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">เวลา</label>
              <input
                type="time"
                className="form-input"
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
              />
            </div>
          </div>

          {/* Attendees - multi select */}
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">ผู้เข้าร่วมประชุม</label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              padding: '0.75rem',
              backgroundColor: 'var(--color-surface-hover)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}>
              {activeMembers.map(m => {
                const isSelected = form.attendees.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAttendee(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.3rem 0.6rem',
                      borderRadius: 'var(--radius-full)',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      backgroundColor: isSelected ? '#eff6ff' : 'var(--color-surface)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <MemberAvatar name={m.name} size="sm" />
                    {m.name}
                    {isSelected && <HiCheckCircle style={{ fontSize: '0.9rem' }} />}
                  </button>
                );
              })}
              {form.attendees.filter(id => !activeMembers.find(m => m.id === id)).map(customName => (
                <button
                  key={customName}
                  type="button"
                  onClick={() => toggleAttendee(customName)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.3rem 0.6rem',
                    borderRadius: 'var(--radius-full)',
                    border: '2px solid var(--color-primary)',
                    backgroundColor: '#eff6ff',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <MemberAvatar name={customName} size="sm" />
                  {customName}
                  <HiCheckCircle style={{ fontSize: '0.9rem' }} />
                </button>
              ))}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', width: '100%' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="พิมพ์ชื่อบุคคลภายนอก แล้วกดปุ่มเพิ่ม..."
                  value={customAttendee}
                  onChange={e => setCustomAttendee(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomAttendee();
                    }
                  }}
                  style={{ flex: 1, fontSize: '0.85rem' }}
                />
                <button type="button" className="btn btn-sm btn-primary" onClick={addCustomAttendee} style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>เพิ่ม</button>
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">วาระการประชุม</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="เขียนวาระการประชุม แต่ละหัวข้อขึ้นบรรทัดใหม่"
              value={form.agenda}
              onChange={e => setForm({ ...form, agenda: e.target.value })}
            ></textarea>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">สรุปการประชุม</label>
            <div style={{ backgroundColor: 'var(--color-surface)' }}>
              <ReactQuill
                theme="snow"
                value={form.notes}
                onChange={value => setForm({ ...form, notes: value })}
                placeholder="สรุปเนื้อหาที่ประชุม (พิมพ์ข้อความ, ตัวหนา, ตัวเอียง, หรือรายการได้เหมือน Word)"
                style={{ height: '200px', marginBottom: '40px' }}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['link', 'clean']
                  ],
                }}
              />
            </div>
          </div>

          {/* Action Items / Follow-ups */}
          <div style={{ marginTop: '1.25rem', padding: '1rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label className="form-label" style={{ margin: 0, color: 'var(--color-primary)', fontWeight: 600 }}>
                ⚡ รายการที่ต้องทำ / ติดตาม
              </label>
              <button type="button" className="btn btn-sm btn-secondary" onClick={addFormItem} style={{ fontSize: '0.75rem' }}>
                <HiPlus /> เพิ่มรายการ
              </button>
            </div>

            {formItems.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '0.75rem 0' }}>
                ยังไม่มีรายการ — กดปุ่ม "เพิ่มรายการ" เพื่อเพิ่ม
              </p>
            )}

            {formItems.map((item, idx) => (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
              }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1, fontSize: '0.85rem' }}
                    placeholder="รายละเอียด"
                    value={item.title}
                    onChange={e => updateFormItem(idx, 'title', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeFormItem(idx)}
                    style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}
                  >
                    <HiXMark style={{ fontSize: '1.1rem' }} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
                  <select
                    className="form-select"
                    style={{ fontSize: '0.8rem' }}
                    value={item.itemCategory}
                    onChange={e => updateFormItem(idx, 'itemCategory', e.target.value)}
                  >
                    <option value="task">งานทั่วไป</option>
                    <option value="content">คอนเทนต์</option>
                  </select>
                  <select
                    className="form-select"
                    style={{ fontSize: '0.8rem' }}
                    value={item.company}
                    onChange={e => updateFormItem(idx, 'company', e.target.value)}
                  >
                    <option value="GFS">GFS</option>
                    <option value="MHL">MHL</option>
                    <option value="CAR">CAR</option>
                  </select>
                  <select
                    className="form-select"
                    style={{ fontSize: '0.8rem' }}
                    value={item.memberId}
                    onChange={e => updateFormItem(idx, 'memberId', e.target.value)}
                  >
                    <option value="">-- ผู้รับผิดชอบ --</option>
                    <option value="all">ทุกคน</option>
                    {activeMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="form-input"
                    style={{ fontSize: '0.8rem' }}
                    value={item.deadline}
                    onChange={e => updateFormItem(idx, 'deadline', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">{isEditing ? 'บันทึกการแก้ไข' : 'สร้างบันทึก'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="ยืนยันการลบบันทึกประชุม"
        message="คุณต้องการลบบันทึกประชุมนี้ใช่หรือไม่? รายการ Action Items ทั้งหมดจะถูกลบไปด้วย"
      />
    </div>
  );
}
