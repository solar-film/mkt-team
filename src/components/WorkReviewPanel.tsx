'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { HiChartBar } from 'react-icons/hi2';
import { fetchWorkspace } from '@/lib/workspace-fetch';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { FIRST_REVIEW, PROMOTION, REVISE_REASON } from '@/lib/work-review';

export interface WorkReviewValues {
  submittedAt?: string | null;
  waitingOn?: string | null;
  firstReview?: string | null;
  reviseReason?: string | null;
  promotion?: string | null;
}

/** "ผลงาน KPI" inside a task/content popup: the facts KPI กลาง counts. */
export default function WorkReviewPanel({ kind, id, values, onSaved }: {
  kind: 'task' | 'content';
  id: string;
  values: WorkReviewValues;
  onSaved: (saved: WorkReviewValues) => void;
}) {
  const [form, setForm] = useState({
    submittedDay: values.submittedAt ? bangkokDateKey(values.submittedAt) : '',
    waitingOn: values.waitingOn ?? '',
    firstReview: values.firstReview ?? '',
    reviseReason: values.reviseReason ?? '',
    promotion: values.promotion ?? '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      // A typed day is stored as noon Thai time so it stays the same calendar day everywhere.
      const keptDay = values.submittedAt ? bangkokDateKey(values.submittedAt) : '';
      const submittedAt = form.submittedDay === keptDay ? undefined : form.submittedDay ? `${form.submittedDay}T12:00:00+07:00` : null;
      const response = await fetchWorkspace('/api/work-review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, id, submittedAt, waitingOn: form.waitingOn, firstReview: form.firstReview,
          reviseReason: form.firstReview === 'revise' ? form.reviseReason : null,
          ...(kind === 'content' ? { promotion: form.promotion } : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'บันทึกไม่สำเร็จ');
      onSaved(body);
      toast.success('บันทึกผลงาน KPI แล้ว');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const field = { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem' };
  const label = { fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 };

  return (
    <section aria-label="ผลงาน KPI" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--color-primary)' }}>
        <HiChartBar aria-hidden /> ผลงาน KPI
        <small style={{ marginLeft: 'auto', fontWeight: 400, color: 'var(--color-text-secondary)' }}>นับในหน้า KPI กลาง</small>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <label style={field}>
          <span style={label}>วันส่งจริง</span>
          <input type="date" className="form-input" value={form.submittedDay} onChange={e => setForm({ ...form, submittedDay: e.target.value })} />
        </label>
        <label style={field}>
          <span style={label}>ผลตรวจรอบแรก</span>
          <select className="form-select" value={form.firstReview} onChange={e => setForm({ ...form, firstReview: e.target.value })}>
            <option value="">ยังไม่ตรวจ</option>
            {Object.entries(FIRST_REVIEW).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
        {form.firstReview === 'revise' && (
          <label style={field}>
            <span style={label}>สาเหตุการแก้</span>
            <select className="form-select" value={form.reviseReason} onChange={e => setForm({ ...form, reviseReason: e.target.value })}>
              <option value="">ไม่ระบุ</option>
              {Object.entries(REVISE_REASON).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>
        )}
        {kind === 'content' && (
          <label style={field}>
            <span style={label}>Organic / Paid</span>
            <select className="form-select" value={form.promotion} onChange={e => setForm({ ...form, promotion: e.target.value })}>
              <option value="">ไม่ระบุ</option>
              {Object.entries(PROMOTION).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>
        )}
      </div>
      <label style={field}>
        <span style={label}>สถานะรอ (ถ้าช้าเพราะรอคนอื่น เช่น "รอรูปจากช่าง")</span>
        <input type="text" className="form-input" maxLength={200} value={form.waitingOn} placeholder="เว้นว่างถ้าไม่ได้รอใคร" onChange={e => setForm({ ...form, waitingOn: e.target.value })} />
      </label>
      <button type="button" className="btn btn-primary" onClick={save} disabled={saving} style={{ alignSelf: 'flex-end' }}>
        {saving ? 'กำลังบันทึก…' : 'บันทึกผลงาน KPI'}
      </button>
    </section>
  );
}
