'use client';
import { taskKpiOptions, type TaskKpi } from '@/lib/task-kpi';

interface TaskKpiSelectProps {
  kpis: TaskKpi[];
  members: { id: string; name: string }[];
  memberSelection: string;
  deadline: string;
  value: string;
  onChange: (kpiId: string) => void;
}

const hintStyle = { backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', marginTop: '1rem', textAlign: 'center' as const, color: 'var(--color-text-secondary)', fontSize: '0.85rem' };

/** Optional KPI link for a task; a completed linked task adds one to that KPI's progress. */
export default function TaskKpiSelect({ kpis, members, memberSelection, deadline, value, onChange }: TaskKpiSelectProps) {
  if (!memberSelection || !deadline) {
    return <div className="form-group" style={hintStyle}>เลือกผู้รับผิดชอบและวันครบกำหนดก่อน เพื่อผูกงานกับเป้าหมาย KPI</div>;
  }
  const options = taskKpiOptions(kpis, memberSelection, deadline);
  if (options.length === 0) {
    return <div className="form-group" style={hintStyle}>ไม่พบเป้าหมาย KPI ของผู้รับผิดชอบในเดือนที่เลือก</div>;
  }
  const showOwner = new Set(options.map(kpi => kpi.memberId)).size > 1;
  const selected = options.some(kpi => kpi.id === value) ? value : '';
  return (
    <div className="form-group" style={{ backgroundColor: 'var(--color-surface-hover)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
      <label className="form-label" style={{ color: 'var(--color-primary)' }}>ผูกกับเป้าหมาย KPI (ไม่บังคับ)</label>
      <select className="form-select" value={selected} onChange={e => onChange(e.target.value)}>
        <option value="">-- ไม่เชื่อมโยง --</option>
        {options.map(kpi => (
          <option key={kpi.id} value={kpi.id}>
            {kpi.name}{showOwner ? ` — ${members.find(member => member.id === kpi.memberId)?.name || ''}` : ''}
          </option>
        ))}
      </select>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.4rem' }}>เมื่องานนี้เสร็จ จะนับเพิ่มใน KPI ที่เลือก 1 ครั้ง</div>
    </div>
  );
}
