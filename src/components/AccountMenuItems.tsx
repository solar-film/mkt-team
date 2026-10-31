'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { HiCamera, HiKey } from 'react-icons/hi2';
import { fetchWorkspace } from '@/lib/workspace-fetch';
import { compressAvatar } from '@/lib/avatar-upload';

type Props = {
  memberId: string;
  onAvatarChanged: (avatar: string | null) => void;
  onDone?: () => void;
};

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem 1rem',
  border: 'none', background: 'none', color: '#334155', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', textAlign: 'left',
};

const pinField: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.75rem', fontSize: '1.1rem', letterSpacing: '0.3em',
  border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box',
};

/** "Change photo" and "Change PIN" for the signed-in member only. */
export default function AccountMenuItems({ memberId, onAvatarChanged, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pins, setPins] = useState({ current: '', next: '', confirm: '' });
  const [pinError, setPinError] = useState('');
  const [saving, setSaving] = useState(false);

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const avatar = await compressAvatar(file);
      const res = await fetchWorkspace('/api/members', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: memberId, avatar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถบันทึกรูปภาพได้');
      onAvatarChanged(data.member?.avatar ?? null);
      toast.success('เปลี่ยนรูปโปรไฟล์แล้ว');
      onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถบันทึกรูปภาพได้');
    } finally {
      setUploading(false);
    }
  };

  const digits = (value: string) => value.replace(/\D/g, '').slice(0, 6);

  const changePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pins.next)) { setPinError('PIN ใหม่ต้องเป็นตัวเลข 6 หลัก'); return; }
    if (pins.next !== pins.confirm) { setPinError('PIN ใหม่ทั้งสองช่องไม่ตรงกัน'); return; }
    setSaving(true);
    try {
      const res = await fetchWorkspace('/api/auth/pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin: pins.current, newPin: pins.next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setPinError(data.error || 'เปลี่ยน PIN ไม่สำเร็จ'); return; }
      toast.success('เปลี่ยน PIN แล้ว อุปกรณ์อื่นถูกออกจากระบบ');
      closePin();
      onDone?.();
    } catch {
      setPinError('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const closePin = () => { setPinOpen(false); setPins({ current: '', next: '', confirm: '' }); setPinError(''); };

  const field = (key: keyof typeof pins, label: string, autoComplete: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.875rem', color: '#334155', textAlign: 'left' }}>
      {label}
      <input
        type="password" inputMode="numeric" autoComplete={autoComplete} maxLength={6} required style={pinField}
        value={pins[key]} onChange={e => { setPins(prev => ({ ...prev, [key]: digits(e.target.value) })); setPinError(''); }}
      />
    </label>
  );

  return (
    <>
      <button type="button" style={itemStyle} disabled={uploading} onClick={() => fileRef.current?.click()}>
        <HiCamera size={18} /> {uploading ? 'กำลังอัปโหลด…' : 'เปลี่ยนรูปโปรไฟล์'}
      </button>
      <button type="button" style={itemStyle} onClick={() => setPinOpen(true)}>
        <HiKey size={18} /> เปลี่ยน PIN
      </button>
      <input ref={fileRef} type="file" accept="image/jpeg, image/png, image/webp" style={{ display: 'none' }} onChange={uploadAvatar} />

      {pinOpen && typeof document !== 'undefined' && createPortal(
        <div role="presentation" onClick={closePin}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <form role="dialog" aria-modal="true" aria-labelledby="pin-dialog-title" onSubmit={changePin} onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') closePin(); }}
            style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <h2 id="pin-dialog-title" style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>เปลี่ยน PIN</h2>
            {field('current', 'PIN ปัจจุบัน', 'current-password')}
            {field('next', 'PIN ใหม่ (ตัวเลข 6 หลัก)', 'new-password')}
            {field('confirm', 'ยืนยัน PIN ใหม่', 'new-password')}
            {pinError && <p role="alert" style={{ margin: 0, color: '#dc2626', fontSize: '0.875rem' }}>{pinError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closePin}>ยกเลิก</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
