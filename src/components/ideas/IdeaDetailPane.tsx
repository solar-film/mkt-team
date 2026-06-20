import React, { useState, useRef, useEffect } from 'react';
import { HiXMark, HiPencil, HiEllipsisVertical, HiPlus, HiCheck, HiDocumentText, HiPaperAirplane, HiTrash } from 'react-icons/hi2';
import ConfirmModal from '../ConfirmModal';

interface IdeaDetailPaneProps {
  idea: any;
  members: any[];
  onClose: () => void;
  onUpdate: () => void;
  currentUserId: string | null;
}

export default function IdeaDetailPane({ idea, members, onClose, onUpdate, currentUserId }: IdeaDetailPaneProps) {
  const [newChecklist, setNewChecklist] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [editForm, setEditForm] = useState({
    title: idea.title,
    description: idea.description || '',
    company: idea.company || '',
    priority: idea.priority || 'ด่วนมาก',
    deadline: idea.deadline ? new Date(idea.deadline).toISOString().split('T')[0] : '',
    category: idea.category || 'idea',
    platform: idea.platform || '',
    kpiId: idea.kpiId || ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kpis, setKpis] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/kpis').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setKpis(d);
    }).catch(console.error);
  }, []);

  const currentUser = members.find(m => m.id === currentUserId);
  const owner = members.find(m => m.id === idea.memberId);
  const canEdit = currentUser?.role === 'Admin' || currentUserId === idea.memberId;

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklist.trim()) return;
    
    await fetch(`/api/ideas/${idea.id}/checklists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newChecklist, assigneeId: currentUserId })
    });
    setNewChecklist('');
    onUpdate();
  };

  const handleToggleChecklist = async (checklistId: string, isDone: boolean) => {
    await fetch(`/api/ideas/${idea.id}/checklists`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: checklistId, isDone: !isDone })
    });
    onUpdate();
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUserId) return;

    await fetch(`/api/ideas/${idea.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newComment, memberId: currentUserId })
    });
    setNewComment('');
    onUpdate();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      await fetch(`/api/ideas/${idea.id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, type: file.type, url: base64String })
      });
      onUpdate();
    };
    reader.readAsDataURL(file);
  };

  const updateStatus = async (status: string) => {
    await fetch('/api/ideas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idea.id, title: idea.title, status })
    });
    onUpdate();
  };

  const updateAssignee = async (memberId: string) => {
    await fetch('/api/ideas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idea.id, title: idea.title, memberId })
    });
    onUpdate();
  };

  const handleDeleteIdea = async () => {
    setConfirmConfig({
      isOpen: true,
      title: 'ลบโน๊ตไอเดีย',
      message: 'ยืนยันการลบโน๊ตนี้?',
      onConfirm: async () => {
        await fetch(`/api/ideas?id=${idea.id}`, { method: 'DELETE' });
        onClose();
        onUpdate();
      }
    });
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'ลบ Checklist',
      message: 'ยืนยันการลบ Checklist นี้?',
      onConfirm: async () => {
        await fetch(`/api/ideas/${idea.id}/checklists?checklistId=${checklistId}`, { method: 'DELETE' });
        onUpdate();
      }
    });
  };

  const handleDeleteComment = async (commentId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'ลบความคิดเห็น',
      message: 'ยืนยันการลบความคิดเห็นนี้?',
      onConfirm: async () => {
        await fetch(`/api/ideas/${idea.id}/comments?commentId=${commentId}`, { method: 'DELETE' });
        onUpdate();
      }
    });
  };

  const selectedAssignees = idea.memberId ? idea.memberId.split(',') : [];
  const handleToggleAssignee = async (mId: string) => {
    let newAssignees;
    if (selectedAssignees.includes(mId)) {
      newAssignees = selectedAssignees.filter((id: string) => id !== mId);
    } else {
      newAssignees = [...selectedAssignees, mId];
    }
    await fetch('/api/ideas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idea.id, title: idea.title, memberId: newAssignees.join(',') })
    });
    onUpdate();
  };

  const handleSaveEdit = async () => {
    await fetch('/api/ideas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idea.id, ...editForm })
    });
    setIsEditing(false);
    onUpdate();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'ด่วนมาก': return { bg: '#fee2e2', text: '#ef4444' };
      case 'ด่วน': return { bg: '#fef3c7', text: '#f59e0b' };
      default: return { bg: '#e0f2fe', text: '#3b82f6' };
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'เสร็จแล้ว': return { bg: '#dcfce7', text: '#22c55e' };
      case 'รอตรวจ': return { bg: '#ffedd5', text: '#f97316' };
      default: return { bg: '#f1f5f9', text: '#64748b' };
    }
  };
  
  const pColor = getPriorityColor(idea.priority || 'ปกติ');
  const sColor = getStatusColor(idea.status || 'รอดำเนินการ');

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      {/* Header */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>รายละเอียดโน๊ตงาน</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {canEdit && !isEditing && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setIsEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} title="แก้ไขโน๊ต"><HiPencil size={20} /></button>
              <button onClick={handleDeleteIdea} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="ลบโน๊ต"><HiTrash size={20} /></button>
            </div>
          )}
          {isEditing && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setIsEditing(false)} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem' }}>ยกเลิก</button>
              <button onClick={handleSaveEdit} className="btn btn-primary" style={{ padding: '0.25rem 0.75rem' }}>บันทึก</button>
            </div>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', marginLeft: '0.5rem' }}><HiXMark size={24} /></button>
        </div>
      </div>

      {/* Content Scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ backgroundColor: pColor.bg, color: pColor.text, padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
            {idea.priority || 'ปกติ'}
          </span>
        </div>

        {isEditing ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              className="form-input" 
              value={editForm.title} 
              onChange={e => setEditForm({...editForm, title: e.target.value})} 
              style={{ fontSize: '1.5rem', fontWeight: 800, padding: '0.5rem', marginBottom: '1rem' }} 
            />
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select className="form-select" value={editForm.company} onChange={e => setEditForm({...editForm, company: e.target.value})} style={{ width: 'auto' }}>
                <option value="">ไม่ระบุบริษัท</option>
                <option value="GFS">GFS</option>
                <option value="MHL">MHL</option>
                <option value="CAR">CAR</option>
              </select>
              
              <select className="form-select" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} style={{ width: 'auto' }}>
                <option value="idea">💡 โน๊ตไอเดีย</option>
                <option value="task">📝 งานทั่วไป</option>
                <option value="content">🎬 คอนเท้น</option>
              </select>

              {editForm.category === 'content' && (
                <>
                  <select className="form-select" value={editForm.platform} onChange={e => setEditForm({...editForm, platform: e.target.value})} style={{ width: 'auto' }}>
                    <option value="">ระบุแพลตฟอร์ม</option>
                    <option value="Facebook">Facebook</option>
                    <option value="TikTok">TikTok</option>
                    <option value="YouTube">YouTube</option>
                    <option value="IG">IG</option>
                    <option value="Lemon8">Lemon8</option>
                  </select>

                  <select className="form-select" value={editForm.kpiId} onChange={e => setEditForm({...editForm, kpiId: e.target.value})} style={{ width: 'auto' }}>
                    <option value="">ไม่เชื่อมโยง KPI</option>
                    {kpis.map(kpi => (
                      <option key={kpi.id} value={kpi.id}>{kpi.name} ({kpi.month}/{kpi.year})</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', lineHeight: 1.3 }}>
              {idea.title}
            </h1>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem' }}>{idea.company || 'บริษัท'}</span>
              <span style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem' }}>
                {idea.category === 'task' ? '📝 งานทั่วไป' : idea.category === 'content' ? '🎬 คอนเท้น' : '💡 โน๊ตไอเดีย'}
              </span>
              {idea.category === 'content' && idea.platform && (
                <span style={{ backgroundColor: '#fce7f3', color: '#db2777', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem' }}>
                  {idea.platform}
                </span>
              )}
            </div>
          </>
        )}

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1rem', marginBottom: '2rem', fontSize: '0.9rem', alignItems: 'center' }}>
          <div style={{ color: '#64748b' }}>🔔 ผู้รับผิดชอบ</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
            {canEdit ? (
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {members.filter(m => m.status !== 'inactive').map(m => {
                  const isSelected = selectedAssignees.includes(m.id);
                  return (
                    <div 
                      key={m.id} 
                      onClick={() => handleToggleAssignee(m.id)}
                      style={{ 
                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer',
                        backgroundColor: isSelected ? '#3b82f6' : '#f1f5f9',
                        color: isSelected ? 'white' : '#64748b',
                        border: isSelected ? 'none' : '1px solid #e2e8f0'
                      }}
                    >
                      {m.name}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {selectedAssignees.map((id: string) => {
                   const m = members.find(x => x.id === id);
                   if (!m) return null;
                   return (
                     <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '4px 8px', borderRadius: '12px', backgroundColor: '#f1f5f9' }}>
                       {m.avatar ? <img src={m.avatar} alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} /> : <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#cbd5e1' }} />}
                       <span style={{ fontSize: '0.75rem', color: '#0f172a' }}>{m.name}</span>
                     </div>
                   );
                })}
                {selectedAssignees.length === 0 && <span style={{ color: '#94a3b8' }}>-</span>}
              </div>
            )}
          </div>

          <div style={{ color: '#64748b' }}>🕒 Deadline</div>
          <div style={{ fontWeight: 500 }}>
            {isEditing ? (
              <input type="date" className="form-input" value={editForm.deadline} onChange={e => setEditForm({...editForm, deadline: e.target.value})} style={{ padding: '4px 8px', width: 'auto' }} />
            ) : (
              idea.deadline ? new Date(idea.deadline).toLocaleDateString('th-TH') : '-'
            )}
          </div>

          <div style={{ color: '#64748b' }}>💬 สถานะ</div>
          <div>
            <select 
              value={idea.status || 'รอดำเนินการ'} 
              onChange={(e) => updateStatus(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: '12px', border: `1px solid ${sColor.text}`, backgroundColor: sColor.bg, color: sColor.text, fontSize: '0.85rem', fontWeight: 600, outline: 'none' }}
            >
              <option value="รอดำเนินการ">รอดำเนินการ</option>
              <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
              <option value="รอตรวจ">รอตรวจ</option>
              <option value="เสร็จแล้ว">เสร็จแล้ว</option>
            </select>
          </div>

          <div style={{ color: '#64748b' }}>⭐ Priority</div>
          <div style={{ fontWeight: 500, color: '#ef4444' }}>
            {isEditing ? (
              <select className="form-select" value={editForm.priority} onChange={e => setEditForm({...editForm, priority: e.target.value})} style={{ padding: '4px 8px', width: 'auto' }}>
                <option value="ปกติ">ปกติ</option>
                <option value="ด่วน">ด่วน</option>
                <option value="ด่วนมาก">ด่วนมาก</option>
              </select>
            ) : (
              idea.priority || 'ด่วนมาก'
            )}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>รายละเอียด</h3>
          {isEditing ? (
            <textarea 
              className="form-textarea" 
              rows={5} 
              value={editForm.description} 
              onChange={e => setEditForm({...editForm, description: e.target.value})} 
            />
          ) : (
            <p style={{ color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
              {idea.description || '-'}
            </p>
          )}
        </div>

        {/* Checklist */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>สิ่งที่ต้องทำ (Checklist)</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {idea.checklists?.map((item: any) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button 
                    onClick={() => canEdit && handleToggleChecklist(item.id, item.isDone)}
                    disabled={!canEdit}
                    style={{ 
                      width: 20, height: 20, borderRadius: '4px', 
                      backgroundColor: item.isDone ? '#4f46e5' : (canEdit ? 'white' : '#f1f5f9'),
                      border: item.isDone ? 'none' : '1px solid #cbd5e1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canEdit ? 'pointer' : 'default'
                    }}
                  >
                    {item.isDone && <HiCheck color="white" size={14} />}
                  </button>
                  <span style={{ textDecoration: item.isDone ? 'line-through' : 'none', color: item.isDone ? '#94a3b8' : '#334155', fontSize: '0.9rem' }}>
                    {item.title}
                  </span>
                </div>
                {canEdit && (
                  <button onClick={() => handleDeleteChecklist(item.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}>
                    <HiTrash size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {canEdit && (
            <form onSubmit={handleAddChecklist} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={newChecklist} 
                onChange={e => setNewChecklist(e.target.value)} 
                placeholder="เพิ่มสิ่งที่ต้องทำ..." 
                style={{ flex: 1, padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
              />
              <button type="submit" style={{ backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', color: '#475569' }}>
                <HiPlus size={20} />
              </button>
            </form>
          )}
        </div>

        {/* Attachments */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>ไฟล์แนบ</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {idea.attachments?.map((file: any) => (
              <div key={file.id} style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', position: 'relative' }}>
                {file.type.startsWith('image/') ? (
                  <img src={file.url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', flexDirection: 'column' }}>
                    <HiDocumentText size={24} color="#94a3b8" />
                    <span style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>{file.name}</span>
                  </div>
                )}
              </div>
            ))}
            
            {canEdit && (
              <>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px dashed #cbd5e1', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                >
                  <HiPlus size={20} />
                  <span style={{ fontSize: '0.7rem', marginTop: '4px' }}>เพิ่มไฟล์</span>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
              </>
            )}
          </div>
        </div>

        {/* Comments */}
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>ความคิดเห็น</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {idea.comments?.map((comment: any) => {
              const cUser = members.find(m => m.id === comment.memberId);
              return (
                <div key={comment.id} style={{ display: 'flex', gap: '1rem' }}>
                  {cUser?.avatar ? <img src={cUser.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} /> : <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#e2e8f0' }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{cUser?.name || 'Unknown'}</span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(comment.createdAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '0 12px 12px 12px', color: '#334155', fontSize: '0.9rem' }}>
                      {comment.text}
                    </div>
                  </div>
                  {(currentUser?.role === 'Admin' || currentUserId === comment.memberId) && (
                    <button onClick={() => handleDeleteComment(comment.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', alignSelf: 'flex-start', marginTop: '0.5rem' }}>
                      <HiTrash size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Comment Input */}
      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
        <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input 
            type="text" 
            value={newComment} 
            onChange={e => setNewComment(e.target.value)}
            placeholder="เขียนความคิดเห็น..." 
            style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '24px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
          />
          <button type="submit" disabled={!newComment.trim()} style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: newComment.trim() ? '#4f46e5' : '#cbd5e1', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: newComment.trim() ? 'pointer' : 'not-allowed', transition: 'background-color 0.2s' }}>
            <HiPaperAirplane size={18} style={{ transform: 'rotate(45deg)', marginLeft: '-2px' }} />
          </button>
        </form>
      </div>

      <ConfirmModal 
        {...confirmConfig} 
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} 
      />
    </div>
  );
}
