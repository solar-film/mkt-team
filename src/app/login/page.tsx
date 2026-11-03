'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { HiUser, HiArrowLeft, HiLockClosed } from 'react-icons/hi2';

interface Member {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
  hasPin: boolean;
}

const ORDER = ['OIL', 'TAW', 'PLENG', 'NON'];

export default function LoginPage() {
  const { login, currentUserId, isLoading } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && currentUserId) router.replace('/');
  }, [isLoading, currentUserId, router]);

  useEffect(() => {
    fetch('/api/auth/members', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: Member[]) => {
        data.sort((a, b) => {
          const indexA = ORDER.findIndex(name => a.name.toUpperCase().includes(name));
          const indexB = ORDER.findIndex(name => b.name.toUpperCase().includes(name));
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.name.localeCompare(b.name);
        });
        setMembers(data);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selected) pinRef.current?.focus();
  }, [selected]);

  const choose = (member: Member) => {
    setSelected(member);
    setPin('');
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || submitting) return;
    if (!/^\d{6}$/.test(pin)) { setError('กรุณาใส่ PIN ตัวเลข 6 หลัก'); return; }
    setSubmitting(true);
    const result = await login(selected.id, pin);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      setPin('');
      pinRef.current?.focus();
    }
  };

  const avatar = (member: Member, size: number) => (
    <div className="profile-avatar" style={{ width: size, height: size }}>
      {member.avatar ? (
        <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <HiUser size={size * 0.45} color="#94a3b8" />
      )}
    </div>
  );

  return (
    <div className="login-container">
      <style dangerouslySetInnerHTML={{__html: `
        .login-container {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: #f8fafc;
          padding: 2rem;
        }
        .login-box {
          max-width: 600px;
          width: 100%;
          background-color: white;
          border-radius: 24px;
          padding: 3rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          text-align: center;
        }
        .login-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 1.5rem;
          justify-items: center;
        }
        .profile-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border-radius: 16px;
          border: none;
          background: transparent;
          font: inherit;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }
        .profile-card:hover:not(:disabled), .profile-card:focus-visible {
          background-color: #f1f5f9;
          transform: translateY(-5px);
        }
        .profile-card:disabled { cursor: not-allowed; opacity: 0.55; }
        .profile-avatar {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background-color: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 3px solid white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          flex-shrink: 0;
        }
        .pin-input {
          width: 100%;
          max-width: 240px;
          font-size: 1.75rem;
          letter-spacing: 0.6em;
          text-align: center;
          padding: 0.75rem 0 0.75rem 0.6em;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          outline: none;
        }
        .pin-input:focus { border-color: #034aad; }
        @media (max-width: 480px) {
          .login-container { padding: 1rem; }
          .login-box { padding: 2rem 1rem; }
          .login-grid { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
          .profile-card { padding: 0.5rem; gap: 0.5rem; }
          .profile-card h3 { font-size: 0.9rem !important; }
          .profile-card p { font-size: 0.75rem !important; }
        }
      `}} />

      <div className="login-box">
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>ยินดีต้อนรับสู่ระบบ</h1>

        {selected ? (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <p style={{ color: '#64748b', margin: 0 }}>ใส่ PIN 6 หลักของคุณ</p>
            {avatar(selected, 90)}
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{selected.name}</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{selected.role}</p>
            </div>
            <label htmlFor="pin" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>PIN</label>
            <input
              id="pin"
              ref={pinRef}
              className="pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'pin-error' : undefined}
            />
            {error && <p id="pin-error" role="alert" style={{ color: '#dc2626', margin: 0, fontSize: '0.9rem' }}>{error}</p>}
            <button
              type="submit"
              disabled={submitting || pin.length !== 6}
              style={{
                width: '100%', maxWidth: '240px', padding: '0.8rem', borderRadius: '10px', border: 'none',
                backgroundColor: '#023a8a', color: 'white', fontSize: '1rem', fontWeight: 600,
                cursor: submitting || pin.length !== 6 ? 'not-allowed' : 'pointer', opacity: submitting || pin.length !== 6 ? 0.6 : 1,
              }}
            >
              {submitting ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              <HiArrowLeft size={16} /> เลือกชื่ออื่น
            </button>
          </form>
        ) : (
          <>
            <p style={{ color: '#64748b', marginBottom: '2.5rem' }}>กรุณาเลือกโปรไฟล์ของคุณเพื่อเข้าใช้งาน</p>
            {loading ? (
              <div className="loading-container"><div className="loading-spinner"></div></div>
            ) : loadError ? (
              <p role="alert" style={{ color: '#dc2626' }}>โหลดรายชื่อไม่สำเร็จ กรุณารีเฟรชหน้า</p>
            ) : (
              <div className="login-grid">
                {members.map(member => (
                  <button key={member.id} type="button" className="profile-card" disabled={!member.hasPin} onClick={() => choose(member)}>
                    {avatar(member, 90)}
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{member.name}</h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                        {member.hasPin ? member.role : <><HiLockClosed size={12} style={{ verticalAlign: '-1px' }} /> ยังไม่มี PIN ติดต่อผู้ดูแล</>}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
