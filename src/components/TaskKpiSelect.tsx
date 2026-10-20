'use client';
import { joinKpiIds, parseKpiIds, taskKpiOptions, type TaskKpi } from '@/lib/task-kpi';

interface TaskKpiSelectProps {
  kpis: TaskKpi[];
  members: { id: string; name: string }[];
  memberSelection: string;
  deadline: string;
  value: string;
  onChange: (kpiIds: string) => void;
}

const hintStyle = { backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', marginTop: '1rem', textAlign: 'center' as const, color: 'var(--color-text-secondary)', fontSize: '0.85rem' };

/** Optional KPI links for a task; each ticked KPI gains one when the task is completed. */
export default function TaskKpiSelect({ kpis, members, memberSelection, deadline, value, onChange }: TaskKpiSelectProps) {
  if (!memberSelection || !deadline) {
    return <div className="form-group" style={hintStyle}>เลือกผู้รับผิดชอบและวันครบกำหนดก่อน เพื่อผูกงานกับเป้าหมาย KPI</div>;
  }
  const options = taskKpiOptions(kpis, memberSelection, deadline);
  if (options.length === 0) {
    return <div className="form-group" style={hintStyle}>ไม่พบเป้าหมาย KPI ของผู้รับผิดชอบในเดือนที่เลือก</div>;
  }
  const selected = new Set(parseKpiIds(value));
  const showOwner = new Set(options.map(kpi => kpi.memberId)).size > 1;
  const toggle = (kpiId: string) => {
    const next = options.map(kpi => kpi.id).filter(id => (id === kpiId ? !selected.has(id) : selected.has(id)));
    onChange(joinKpiIds(next) || '');
  };
  return (
    <div className="form-group" style={{ backgroundColor: 'var(--color-surface-hover)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
      <label className="form-label" style={{ color: 'var(--color-primary)' }}>ผูกกับเป้าหมาย KPI (ไม่บังคับ · เลือกได้หลายรายการ)</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {options.map(kpi => (
          <label key={kpi.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={selected.has(kpi.id)} onChange={() => toggle(kpi.id)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            <span>{kpi.name}{showOwner ? ` — ${members.find(member => member.id === kpi.memberId)?.name || ''}` : ''}</span>
          </label>
        ))}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.4rem' }}>เมื่องานนี้เสร็จ KPI ที่ติ๊กไว้ทุกตัวจะนับเพิ่ม 1 ครั้ง</div>
    </div>
  );
}
