'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { fetchWorkspace } from '@/lib/workspace-fetch';
import { PROMOTION } from '@/lib/work-review';

export interface ReportReachValue { reach7: number; source: string }

/** Figures pulled from Facebook/TikTok (Windsor) are shown, not typed over. */
export const isAutoReach = (source: string) => source === 'api' || source === 'windsor';

interface Saved { promotion?: string | null; reach7?: number | null; reach7Source?: string | null }

async function save(id: string, body: { promotion?: string; reach7?: string }): Promise<Saved> {
  const response = await fetchWorkspace('/api/work-review', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'content', id, ...body }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'บันทึกไม่สำเร็จ');
  return result;
}

const fieldStyle = { padding: '0.3rem 0.5rem', fontSize: '0.8rem', borderRadius: '8px' };

/**
 * Reach @7 วัน of one content on รายงานรวม: automatic figures are read-only; otherwise a small box
 * that saves when the member leaves it or presses Enter. An empty box clears a typed figure.
 */
export function ReachField({ contentId, title, reach, onSaved }: {
  contentId: string;
  title: string;
  reach?: ReportReachValue;
  onSaved: (reach: ReportReachValue | null) => void;
}) {
  const stored = reach ? String(reach.reach7) : '';
  const [draft, setDraft] = useState(stored);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(stored), [stored]);

  if (reach && isAutoReach(reach.source)) {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }} title="ดึงอัตโนมัติจาก Facebook/TikTok แก้ไม่ได้">
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{reach.reach7.toLocaleString('th-TH')}</span>
        <span style={{ fontSize: '0.65rem', color: '#034aad' }}>ดึงอัตโนมัติ</span>
      </span>
    );
  }

  const commit = async () => {
    const typed = draft.replace(/,/g, '').trim();
    if (typed === stored || saving) return;
    setSaving(true);
    try {
      const saved = await save(contentId, { reach7: typed });
      onSaved(saved.reach7 == null ? null : { reach7: saved.reach7, source: saved.reach7Source ?? 'manual' });
      toast.success('บันทึก Reach แล้ว');
    } catch (error) {
      setDraft(stored);
      toast.error(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      type="text" inputMode="numeric" className="form-input" maxLength={13}
      style={{ ...fieldStyle, width: '96px', textAlign: 'right' }}
      value={draft} placeholder="กรอก" disabled={saving}
      aria-label={`Reach @7 วัน ของ ${title}`}
      title="Reach วันที่ 7 หลังโพสต์ (คน) · กด Enter หรือคลิกที่อื่นเพื่อบันทึก"
      onChange={e => setDraft(e.target.value.replace(/[^\d,]/g, ''))}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(stored); e.currentTarget.blur(); } }}
    />
  );
}

/** Organic/Paid of one content on รายงานรวม; saves as soon as it is chosen. */
export function PromotionField({ contentId, title, value, onSaved }: {
  contentId: string;
  title: string;
  value: string | null | undefined;
  onSaved: (promotion: string | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const change = async (next: string) => {
    setSaving(true);
    try {
      const saved = await save(contentId, { promotion: next });
      onSaved(saved.promotion ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };
  return (
    <select
      className="form-select" style={{ ...fieldStyle, width: '104px', paddingRight: '1.5rem' }}
      value={value ?? ''} disabled={saving} aria-label={`Organic หรือ Paid ของ ${title}`}
      onChange={e => void change(e.target.value)}
    >
      <option value="">ไม่ระบุ</option>
      {Object.entries(PROMOTION).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select>
  );
}
