'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { HiUser, HiCamera, HiCheckCircle } from 'react-icons/hi2';

interface Member {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
  status: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/members')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const activeMembers = data.filter((m: Member) => m.status !== 'inactive');
          const order = ['OIL', 'TEW', 'PLENG', 'NON'];
          activeMembers.sort((a, b) => {
            const indexA = order.findIndex(name => a.name.toUpperCase().includes(name));
            const indexB = order.findIndex(name => b.name.toUpperCase().includes(name));
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.name.localeCompare(b.name);
          });
          setMembers(activeMembers);
        }
        setLoading(false);
      });
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMember) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 2MB');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      
      try {
        const res = await fetch('/api/members', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedMember.id,
            avatar: base64String
          })
        });

        if (res.ok) {
          const updated = await res.json();
          setMembers(members.map(m => m.id === updated.member.id ? updated.member : m));
          setSelectedMember(updated.member);
        } else {
          alert('ไม่สามารถบันทึกรูปภาพได้');
        }
      } catch (error) {
        console.error('Upload error:', error);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = (e: React.MouseEvent, member: Member) => {
    e.stopPropagation();
    setSelectedMember(member);
    fileInputRef.current?.click();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '3rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>ยินดีต้อนรับสู่ระบบ</h1>
        <p style={{ color: '#64748b', marginBottom: '2.5rem' }}>กรุณาเลือกโปรไฟล์ของคุณเพื่อเข้าใช้งาน</p>

        {loading ? (
          <div className="loading-container"><div className="loading-spinner"></div></div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '1.5rem',
            justifyItems: 'center'
          }}>
            {members.map(member => (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem',
                  cursor: 'pointer',
                  padding: '1rem',
                  borderRadius: '16px',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
                className="profile-card"
                onClick={() => login(member.id)}
              >
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  backgroundColor: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  border: '3px solid white',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                }}>
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <HiUser size={40} color="#94a3b8" />
                  )}
                  
                  {/* Edit Avatar Button */}
                  <button
                    onClick={(e) => triggerFileInput(e, member)}
                    style={{
                      position: 'absolute',
                      bottom: '0',
                      right: '0',
                      left: '0',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      color: 'white',
                      border: 'none',
                      padding: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      opacity: 0,
                      transition: 'opacity 0.2s'
                    }}
                    className="edit-avatar-btn"
                    title="เปลี่ยนรูปโปรไฟล์"
                  >
                    <HiCamera size={16} />
                  </button>
                </div>
                
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{member.name}</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{member.role}</p>
                </div>

                {uploading && selectedMember?.id === member.id && (
                  <div style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#3b82f6' }}>
                    <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => login('GUEST')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
          >
            <HiUser size={18} />
            เข้าดูโดยไม่ระบุชื่อ
          </button>
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/jpeg, image/png, image/webp" 
        onChange={handleFileChange} 
      />

      <style dangerouslySetInnerHTML={{__html: `
        .profile-card:hover {
          background-color: #f1f5f9;
          transform: translateY(-5px);
        }
        .profile-card:hover .edit-avatar-btn {
          opacity: 1 !important;
        }
      `}} />
    </div>
  );
}
