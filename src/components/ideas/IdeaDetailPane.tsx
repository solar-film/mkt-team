import React, { useState, useRef } from 'react';
import { HiXMark, HiEllipsisVertical, HiPencil, HiCheck, HiPaperClip, HiPaperAirplane, HiPlus, HiDocumentText } from 'react-icons/hi2';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const owner = members.find(m => m.id === idea.memberId);

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

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      {/* Header */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>รายละเอียดโน๊ตงาน</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><HiPencil size={20} /></button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><HiEllipsisVertical size={20} /></button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><HiXMark size={24} /></button>
        </div>
      </div>

      {/* Content Scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
            {idea.priority || 'ด่วนมาก'}
          </span>
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', lineHeight: 1.3 }}>
          {idea.title}
        </h1>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem' }}>{idea.company || 'บริษัท'}</span>
          <span style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem' }}>Content</span>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1rem', marginBottom: '2rem', fontSize: '0.9rem' }}>
          <div style={{ color: '#64748b' }}>🔔 ผู้รับผิดชอบ</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
            {owner?.avatar ? <img src={owner.avatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} /> : <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#e2e8f0' }} />}
            {owner?.name || '-'}
          </div>

          <div style={{ color: '#64748b' }}>🕒 Deadline</div>
          <div style={{ fontWeight: 500 }}>{idea.deadline ? new Date(idea.deadline).toLocaleDateString('th-TH') : '-'}</div>

          <div style={{ color: '#64748b' }}>💬 สถานะ</div>
          <div>
            <select 
              value={idea.status || 'รอดำเนินการ'} 
              onChange={(e) => updateStatus(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '0.85rem', fontWeight: 600, outline: 'none' }}
            >
              <option value="รอดำเนินการ">รอดำเนินการ</option>
              <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
              <option value="รอตรวจ">รอตรวจ</option>
              <option value="เสร็จแล้ว">เสร็จแล้ว</option>
            </select>
          </div>

          <div style={{ color: '#64748b' }}>⭐ Priority</div>
          <div style={{ fontWeight: 500, color: '#ef4444' }}>{idea.priority || 'ด่วนมาก'}</div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>รายละเอียด</h3>
          <p style={{ color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
            {idea.description || '-'}
          </p>
        </div>

        {/* Checklist */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>สิ่งที่ต้องทำ (Checklist)</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {idea.checklists?.map((item: any) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button 
                    onClick={() => handleToggleChecklist(item.id, item.isDone)}
                    style={{ 
                      width: 20, height: 20, borderRadius: '4px', 
                      backgroundColor: item.isDone ? '#4f46e5' : 'white',
                      border: item.isDone ? 'none' : '1px solid #cbd5e1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                  >
                    {item.isDone && <HiCheck color="white" size={14} />}
                  </button>
                  <span style={{ textDecoration: item.isDone ? 'line-through' : 'none', color: item.isDone ? '#94a3b8' : '#334155', fontSize: '0.9rem' }}>
                    {item.title}
                  </span>
                </div>
              </div>
            ))}
          </div>

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
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px dashed #cbd5e1', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
            >
              <HiPlus size={20} />
              <span style={{ fontSize: '0.7rem', marginTop: '4px' }}>เพิ่มไฟล์</span>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
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
    </div>
  );
}
