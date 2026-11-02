'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { HiChartBar } from 'react-icons/hi2';
import { fetchWorkspace } from '@/lib/workspace-fetch';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { FIRST_REVIEW, PROMOTION, REVISE_REASON } from '@/lib/work-review';
import { PAGE_METRIC_SOURCE } from '@/lib/facebook-posts';

export interface WorkReviewValues {
  submittedAt?: string | null;
  waitingOn?: string | null;
  firstReview?: string | null;
  reviseReason?: string | null;
  promotion?: string | null;
  /** มะลิ (AI) suggestion, set through /api/kpi-hub/ai-reviews; read-only here. */
  aiReview?: string | null;
  aiReviewNote?: string | null;
  aiReviewedAt?: string | null;
}

/** "ผลงาน KPI" inside a task/content popup: the facts KPI กลาง counts. */
export default function WorkReviewPanel({ kind, id, values, canReview, onSaved }: {
  kind: 'task' | 'content';
  id: string;
  values: WorkReviewValues;
  /** Only the Admin may set the first review result; the API enforces the same rule. */
  canReview: boolean;
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
  // Reach @7 วัน sits in the content's D+7 stats, so it is loaded apart from the task list.
  const [reach, setReach] = useState<{ status: 'loading' | 'ready' | 'failed'; saved: number | null; source: string | null; typed: string }>(
    { status: kind === 'content' ? 'loading' : 'ready', saved: null, source: null, typed: '' });
  const showReach = (reach7: number | null, source: string | null) =>
    setReach({ status: 'ready', saved: reach7, source, typed: reach7 == null ? '' : String(reach7) });

  useEffect(() => {
    if (kind !== 'content') return;
    let live = true;
    fetchWorkspace(`/api/work-review?id=${encodeURIComponent(id)}`)
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error);
        if (live) setReach({ status: 'ready', saved: body.reach7, source: body.reach7Source, typed: body.reach7 == null ? '' : String(body.reach7) });
      })
      .catch(() => { if (live) setReach(prev => ({ ...prev, status: 'failed' })); });
    return () => { live = false; };
  }, [kind, id]);

  const save = async () => {
    setSaving(true);
    try {
      // A typed day is stored as noon Thai time so it stays the same calendar day everywhere.
      const keptDay = values.submittedAt ? bangkokDateKey(values.submittedAt) : '';
      const submittedAt = form.submittedDay === keptDay ? undefined : form.submittedDay ? `${form.submittedDay}T12:00:00+07:00` : null;
      // Reach is sent only once the stored value is known, and only when it was changed.
      const typedReach = reach.typed.replace(/,/g, '').trim();
      const reach7 = kind === 'content' && reach.status === 'ready' && typedReach !== (reach.saved == null ? '' : String(reach.saved))
        ? typedReach : undefined;
      const response = await fetchWorkspace('/api/work-review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, id, submittedAt, waitingOn: form.waitingOn,
          ...(canReview ? { firstReview: form.firstReview, reviseReason: form.firstReview === 'revise' ? form.reviseReason : null } : {}),
          ...(kind === 'content' ? { promotion: form.promotion, reach7 } : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'บันทึกไม่สำเร็จ');
      if (kind === 'content' && 'reach7' in body) showReach(body.reach7, body.reach7Source);
      onSaved(body);
      toast.success('บันทึกผลงาน KPI แล้ว');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const field = { display: 'flex', flexDirection: 'column' as const, gap: '0.3rem', minWidth: 0 };
  const label = { fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 600 };
  const input = { padding: '0.55rem 0.75rem', fontSize: '0.9rem' };
  // Fields sit in a 2-column grid; "สถานะรอ" fills the last row when the count is even, so no cell is left empty.
  const gridFields = 2 + (form.firstReview === 'revise' ? 1 : 0) + (kind === 'content' ? 2 : 0);

  return (
    <section aria-label="ผลงาน KPI" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', fontWeight: 700, color: 'var(--color-primary)' }}>
        <HiChartBar aria-hidden /> ผลงาน KPI
        <small style={{ marginLeft: 'auto', fontWeight: 400, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>นับในหน้า สรุปผลงาน &amp; ประเมิน</small>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem 1rem', alignItems: 'start' }}>
        <label style={field}>
          <span style={label}>วันส่งจริง</span>
          <input type="date" className="form-input" style={input} value={form.submittedDay} onChange={e => setForm({ ...form, submittedDay: e.target.value })} />
        </label>
        <label style={field}>
          <span style={label}>ผลตรวจรอบแรก{canReview ? '' : ' (เฉพาะ Admin)'}</span>
          <select className="form-select" style={input} value={form.firstReview} disabled={!canReview} title={canReview ? undefined : 'เฉพาะ Admin เป็นผู้ตรวจ'} onChange={e => setForm({ ...form, firstReview: e.target.value })}>
            <option value="">ยังไม่ตรวจ</option>
            {Object.entries(FIRST_REVIEW).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
        {form.firstReview === 'revise' && (
          <label style={field}>
            <span style={label}>สาเหตุการแก้</span>
            <select className="form-select" style={input} value={form.reviseReason} disabled={!canReview} onChange={e => setForm({ ...form, reviseReason: e.target.value })}>
              <option value="">ไม่ระบุ</option>
              {Object.entries(REVISE_REASON).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>
        )}
        {kind === 'content' && (
          <label style={field}>
            <span style={label}>Organic / Paid</span>
            <select className="form-select" style={input} value={form.promotion} onChange={e => setForm({ ...form, promotion: e.target.value })}>
              <option value="">ไม่ระบุ</option>
              {Object.entries(PROMOTION).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>
        )}
        {kind === 'content' && (
          <label style={field}>
            <span style={label}>Reach @7 วัน (คน)</span>
            <input type="text" inputMode="numeric" className="form-input" style={input} maxLength={13}
              value={reach.typed} disabled={reach.status !== 'ready'}
              placeholder={reach.status === 'loading' ? 'กำลังโหลด…' : reach.status === 'failed' ? 'โหลดไม่สำเร็จ' : 'ยอด Reach วันที่ 7 หลังโพสต์'}
              onChange={e => setReach({ ...reach, typed: e.target.value.replace(/[^\d,]/g, '') })} />
            {reach.saved != null && reach.source === PAGE_METRIC_SOURCE && (
              <small style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>ดึงอัตโนมัติจาก Facebook · แก้ได้ถ้าไม่ถูก</small>
            )}
          </label>
        )}
        <label style={{ ...field, gridColumn: gridFields % 2 === 0 ? '1 / -1' : undefined }}>
          <span style={label}>สถานะรอ</span>
          <input type="text" className="form-input" style={input} maxLength={200} value={form.waitingOn} placeholder='เช่น "รอรูปจากช่าง"' title="ใส่ถ้าช้าเพราะรอคนอื่น เว้นว่างถ้าไม่ได้รอใคร" onChange={e => setForm({ ...form, waitingOn: e.target.value })} />
        </label>
      </div>
      {values.aiReview && (
        <div role="note" style={{ border: '1px solid #c7d2fe', background: '#eef2ff', borderRadius: '10px', padding: '0.6rem 0.8rem', fontSize: '0.85rem', lineHeight: 1.6 }}>
          <strong style={{ color: values.aiReview === 'pass' ? '#15803d' : '#c2410c' }}>
            มะลิ (AI) แนะนำ: {FIRST_REVIEW[values.aiReview as keyof typeof FIRST_REVIEW] ?? values.aiReview}
          </strong>
          {values.aiReviewedAt && (
            <span style={{ color: 'var(--color-text-secondary)', marginLeft: '0.4rem', fontSize: '0.78rem' }}>
              ตรวจเมื่อ {new Date(values.aiReviewedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
          )}
          {values.aiReviewNote && <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{values.aiReviewNote}</p>}
          <small style={{ color: 'var(--color-text-secondary)' }}>เป็นคำแนะนำ ผลตรวจจริงให้ Admin เลือกเอง</small>
        </div>
      )}
      <button type="button" className="btn btn-primary" onClick={save} disabled={saving} style={{ alignSelf: 'flex-end', padding: '0.55rem 1.25rem' }}>
        {saving ? 'กำลังบันทึก…' : 'บันทึกผลงาน KPI'}
      </button>
    </section>
  );
}
