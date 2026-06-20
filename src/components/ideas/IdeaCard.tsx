import React from 'react';
import { HiStar, HiChatBubbleLeftEllipsis, HiCalendar } from 'react-icons/hi2';

interface Member {
  id: string;
  name: string;
  avatar?: string | null;
}

interface IdeaCardProps {
  idea: any;
  members: Member[];
  isSelected: boolean;
  onClick: () => void;
}

export default function IdeaCard({ idea, members, isSelected, onClick }: IdeaCardProps) {
  const owner = members.find(m => m.id === idea.memberId);
  const recommended = members.find(m => m.id === idea.recommendedFor);

  // Status/Priority Colors
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'ด่วนมาก': return { bg: '#fee2e2', text: '#ef4444', border: '#ef4444' };
      case 'ด่วน': return { bg: '#fef3c7', text: '#f59e0b', border: '#f59e0b' };
      default: return { bg: '#e0f2fe', text: '#3b82f6', border: '#3b82f6' };
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
    <div 
      onClick={onClick}
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1rem',
        cursor: 'pointer',
        borderLeft: \`4px solid \${pColor.border}\`,
        boxShadow: isSelected ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        transform: isSelected ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s ease',
        border: isSelected ? \`1px solid \${pColor.border}\` : '1px solid #e2e8f0',
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
        <HiStar color={idea.priority === 'ด่วนมาก' ? '#f59e0b' : '#cbd5e1'} size={20} />
      </div>

      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem', lineHeight: 1.4 }}>
        {idea.title}
      </h3>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {idea.company && (
          <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
            {idea.company}
          </span>
        )}
        <span style={{ backgroundColor: sColor.bg, color: sColor.text, padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
          {idea.status || 'รอดำเนินการ'}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#64748b', fontSize: '0.8rem' }}>
          {owner && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {owner.avatar ? (
                <img src={owner.avatar} alt={owner.name} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: '#e2e8f0' }} />
              )}
              <span className="truncate" style={{ maxWidth: '80px' }}>{owner.name}</span>
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
