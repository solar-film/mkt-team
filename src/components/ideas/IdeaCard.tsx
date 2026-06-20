import React from 'react';
import { HiStar, HiChatBubbleLeftEllipsis, HiCalendar } from 'react-icons/hi2';

interface Member {
  id: string;
  name: string;
  avatar: string | null;
}

interface IdeaCardProps {
  idea: any;
  members: Member[];
  onClick: () => void;
  isSelected?: boolean;
  currentUserId?: string;
  onToggleStar?: (id: string) => void;
}

export default function IdeaCard({ idea, members, onClick, isSelected, currentUserId, onToggleStar }: IdeaCardProps) {
  const selectedAssignees = idea.memberId ? idea.memberId.split(',') : [];
  const assignees = members.filter(m => selectedAssignees.includes(m.id));
  const recommended = members.find(m => m.id === idea.recommendedFor);
  const isStarred = currentUserId && idea.recommendedFor?.includes(currentUserId);

  // Status/Priority Colors
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'ด่วนมาก': return { bg: '#fee2e2', text: '#ef4444', border: '#ef4444' };
      case 'ด่วน': return { bg: '#fef3c7', text: '#f59e0b', border: '#f59e0b' };
      default: return { bg: '#e0f2fe', text: '#3b82f6', border: '#3b82f6' };
    }
  };

  const formatStatus = (s: string) => {
    if (!s) return 'รอดำเนินการ';
    if (s === 'pending' || s === 'todo') return 'รอดำเนินการ';
    if (s === 'in_progress') return 'กำลังดำเนินการ';
    if (s === 'review') return 'รอตรวจ';
    if (s === 'done' || s === 'completed') return 'เสร็จแล้ว';
    return s;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'เสร็จแล้ว': return { bg: '#dcfce7', text: '#22c55e', cardBg: '#f0fdf4' };
      case 'รอตรวจ': return { bg: '#ffedd5', text: '#f97316', cardBg: '#fff7ed' };
      case 'กำลังดำเนินการ': return { bg: '#e0e7ff', text: '#4f46e5', cardBg: '#f5f7ff' };
      case 'รอดำเนินการ': return { bg: '#f1f5f9', text: '#64748b', cardBg: '#ffffff' };
      default: return { bg: '#f1f5f9', text: '#64748b', cardBg: '#ffffff' };
    }
  };

  const pColor = getPriorityColor(idea.priority || 'ปกติ');
  const displayStatus = formatStatus(idea.status);
  const sColor = getStatusColor(displayStatus);

  return (
    <div 
      onClick={onClick}
      style={{
        backgroundColor: sColor.cardBg,
        borderRadius: '12px',
        padding: '1.25rem',
        cursor: 'pointer',
        borderLeft: `4px solid ${pColor.border}`,
        boxShadow: isSelected ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        transform: isSelected ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s ease',
        border: isSelected ? `1px solid ${pColor.border}` : '1px solid #e2e8f0',
        borderLeftWidth: '4px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ 
            backgroundColor: pColor.bg, 
            color: pColor.text, 
            padding: '2px 8px', 
            borderRadius: '12px', 
            fontSize: '0.75rem', 
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: pColor.text }} />
            {idea.priority || 'ปกติ'}
          </span>
        </div>
        <div 
          onClick={(e) => { e.stopPropagation(); onToggleStar?.(idea.id); }}
          style={{ cursor: onToggleStar ? 'pointer' : 'default' }}
          title={isStarred ? "เลิกติดดาว" : "ติดดาว"}
        >
          <HiStar color={isStarred ? '#f59e0b' : '#cbd5e1'} size={20} />
        </div>
      </div>

      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem', lineHeight: 1.4 }}>
        {idea.title}
      </h3>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {idea.company && (
          <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
            {idea.company}
          </span>
        )}
        {idea.category && (
          <span style={{ 
            backgroundColor: idea.category === 'task' ? '#eef2ff' : idea.category === 'content' ? '#f3e8ff' : '#fffbeb', 
            color: idea.category === 'task' ? '#4f46e5' : idea.category === 'content' ? '#7e22ce' : '#d97706', 
            padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 
          }}>
            {idea.category === 'task' ? '📝 งานทั่วไป' : idea.category === 'content' ? '🎬 คอนเท้น' : '💡 โน๊ตไอเดีย'}
          </span>
        )}
        <span style={{ backgroundColor: sColor.bg, color: sColor.text, padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
          {displayStatus}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#64748b', fontSize: '0.8rem' }}>
          {assignees.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {assignees.map((assignee, idx) => (
                <div key={assignee.id} style={{ 
                  zIndex: 10 - idx,
                  border: '1px solid #e2e8f0',
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  backgroundColor: '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }} title={assignee.name}>
                  {assignee.avatar ? (
                    <img src={assignee.avatar} alt={assignee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>{assignee.name.charAt(0)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <HiCalendar />
            <span>{new Date(idea.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <HiChatBubbleLeftEllipsis />
            <span>{idea.comments?.length || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
