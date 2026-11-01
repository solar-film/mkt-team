'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { HiClipboardDocumentList, HiDocumentText, HiOutlinePencilSquare, HiOutlineTrash, HiPlus } from 'react-icons/hi2';
import { fetchWorkspace } from '@/lib/workspace-fetch';
import { requireOk, saveErrorMessage } from '@/lib/save-result';
import { memberSelectionLabel, parseSelection } from '@/lib/assignments';
import { contentKpiOptions } from '@/lib/content-kpi';
import { parseKpiIds, taskKpiOptions, validTaskKpiIds } from '@/lib/task-kpi';
import type { TeamMember, UnifiedItem } from '@/components/TaskBoard';
import styles from './TaskListView.module.css';

type Kpi = { id: string; name: string; memberId: string; month: number; year: number };

const COMPANIES = ['GFS', 'MHL', 'CAR'];
const PLATFORMS = ['Facebook', 'Instagram', 'TikTok', 'iCONS', 'YouTube', 'Google Map'];
const CONTENT_TYPES: [string, string][] = [['post', 'โพสต์'], ['article', 'บทความ'], ['video', 'วิดีโอ'], ['graphic', 'กราฟิก'], ['reel', 'Reel']];
const STATUSES: [string, string][] = [['todo', 'รอดำเนินการ'], ['in_progress', 'กำลังทำ'], ['done', 'เสร็จแล้ว']];
const MEMBER_ORDER = ['OIL', 'TAW', 'PLENG', 'NON'];

/**
 * ISO date ↔ the value of a date input, in the browser's time zone. The list edits the day only:
 * a changed day keeps the item's time of day, and a new row is due at 17:00 (time is set in the form).
 */
const NEW_ROW_TIME = '17:00';
const toInput = (iso?: string | null) => (iso ? format(new Date(iso), 'yyyy-MM-dd') : '');
const fromInput = (day: string, keepTimeOf?: string | null) => {
  if (!day) return null;
  const time = keepTimeOf ? format(new Date(keepTimeOf), 'HH:mm') : NEW_ROW_TIME;
  const date = new Date(`${day}T${time}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function activeMembers(members: TeamMember[]) {
  const rank = (name: string) => (MEMBER_ORDER.includes(name) ? MEMBER_ORDER.indexOf(name) : MEMBER_ORDER.length);
  return members.filter(m => m.status !== 'inactive').sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

interface Props {
  items: UnifiedItem[];
  members: TeamMember[];
  kpis: Kpi[];
  defaultMemberId: string;
  defaultCompany: string;
  onSaved: () => void;
  onStatusChange: (item: UnifiedItem, status: string) => void;
  onOpen: (item: UnifiedItem) => void;
  onDelete: (item: UnifiedItem) => void;
}

/**
 * Spreadsheet-like view of the tasks board: every cell saves on its own when it changes,
 * and the last row adds a task or content with Enter so a plan can be typed row after row.
 */
export default function TaskListView({ items, members, kpis, defaultMemberId, defaultCompany, onSaved, onStatusChange, onOpen, onDelete }: Props) {
  const people = activeMembers(members);
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ชื่องาน / คอนเทนต์</th>
            <th className={styles.colCompany}>บริษัท</th>
            <th className={styles.colMember}>ผู้รับผิดชอบ</th>
            <th className={styles.colDate}>กำหนดส่ง / เผยแพร่</th>
            <th className={styles.colPlatform} title="แพลตฟอร์ม และรูปแบบคอนเทนต์">แพลตฟอร์ม</th>
            <th className={styles.colKpi}>KPI</th>
            <th className={styles.colStatus}>สถานะ</th>
            <th className={styles.colActions} aria-label="จัดการ" />
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <Row key={item.id} item={item} people={people} members={members} kpis={kpis} onSaved={onSaved} onStatusChange={onStatusChange} onOpen={onOpen} onDelete={onDelete} />
          ))}
          {items.length === 0 && (
            <tr><td colSpan={8} className={styles.empty}>ยังไม่มีรายการตามตัวกรองนี้ · พิมพ์แถวล่างเพื่อเพิ่ม</td></tr>
          )}
        </tbody>
        <tfoot>
          <AddRow people={people} kpis={kpis} defaultMemberId={defaultMemberId} defaultCompany={defaultCompany} onSaved={onSaved} />
        </tfoot>
      </table>
      <p className={styles.hint}>แก้ในช่องได้เลย บันทึกเองเมื่อออกจากช่อง · ชื่อกด Enter เพื่อบันทึก · แถวใหม่ครบกำหนด 17:00 น. · เวลา รายละเอียด และลิงก์ แก้ที่ปุ่มดินสอ</p>
    </div>
  );
}

/** Select whose current value is kept as an option even when it is a multi-pick ("a,b") or unknown. */
function Choice({ value, options, onChange, placeholder, disabled, label }: {
  value: string; options: [string, string][]; onChange: (value: string) => void; placeholder?: string; disabled?: boolean; label: string;
}) {
  const known = !value || options.some(([v]) => v === value);
  return (
    <select className={styles.cell} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} aria-label={label}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {!known && <option value={value}>{value}</option>}
      {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
    </select>
  );
}

function Row({ item, people, members, kpis, onSaved, onStatusChange, onOpen, onDelete }: {
  item: UnifiedItem; people: TeamMember[]; members: TeamMember[]; kpis: Kpi[];
  onSaved: () => void; onStatusChange: Props['onStatusChange']; onOpen: Props['onOpen']; onDelete: Props['onDelete'];
}) {
  const isTask = item.itemType === 'task';
  const isIdea = item.id.startsWith('idea_');
  const date = isTask ? item.deadline : item.publishDate;
  const kpiId = ((item as { kpiId?: string | null }).kpiId) || '';
  const [title, setTitle] = useState(item.title);
  const [when, setWhen] = useState(toInput(date));
  useEffect(() => setTitle(item.title), [item.title]);
  useEffect(() => setWhen(toInput(date)), [date]);

  const save = async (changes: Record<string, unknown>) => {
    try {
      await requireOk(fetchWorkspace(isTask ? '/api/tasks' : '/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, ...changes }),
      }));
      onSaved();
    } catch (err) {
      toast.error(saveErrorMessage(err));
      setTitle(item.title);
      setWhen(toInput(date));
    }
  };

  // Changing who or when can leave the KPI link pointing at another person's or month's target.
  const keptKpi = (memberId: string, isoDate: string | null, platform = item.platform || '') => {
    if (isTask) return validTaskKpiIds(kpis, memberId, isoDate, kpiId);
    return contentKpiOptions(kpis, memberId, isoDate, platform).some(k => k.id === kpiId) ? kpiId : null;
  };
  const withKpi = (changes: Record<string, unknown>, memberId: string, isoDate: string | null, platform?: string) => {
    const next = keptKpi(memberId, isoDate, platform);
    return (next || null) === (kpiId || null) ? changes : { ...changes, kpiId: next };
  };

  const commitTitle = () => {
    const next = title.trim();
    if (!next) { setTitle(item.title); return; }
    if (next !== item.title) void save({ title: next });
  };
  const commitWhen = () => {
    const iso = fromInput(when, date);
    if (toInput(iso) === toInput(date)) return;
    if (!iso) { setWhen(toInput(date)); return; } // a date is required on both kinds
    void save(withKpi(isTask ? { deadline: iso } : { publishDate: iso }, item.memberId, iso));
  };

  const memberOptions: [string, string][] = [...(isTask ? [['all', 'ทุกคน'] as [string, string]] : []), ...people.map(m => [m.id, m.name] as [string, string])];
  const kpiOptions = isTask ? taskKpiOptions(kpis, item.memberId, date) : contentKpiOptions(kpis, item.memberId, date, item.platform || '');
  const multiKpi = isTask && parseKpiIds(kpiId).length > 1;

  if (isIdea) {
    // Ideas keep their own fields; they are edited from the idea form.
    return (
      <tr className={styles.idea}>
        <td colSpan={6}>
          <span className={styles.ideaTitle} title={item.title}><span className={styles.badge}>💡 ไอเดีย</span> {item.title} <small className={styles.muted}>· {memberSelectionLabel(item.memberId, members)}</small></span>
        </td>
        <td><Choice label="สถานะ" value={item.status} options={STATUSES} onChange={status => onStatusChange(item, status)} /></td>
        <td className={styles.actions}><button type="button" className={styles.iconBtn} onClick={() => onOpen(item)} title="แก้ไข"><HiOutlinePencilSquare /></button></td>
      </tr>
    );
  }

  return (
    <tr className={item.status === 'done' ? styles.done : undefined}>
      <td>
        <div className={styles.titleCell}>
          <span className={`${styles.kindIcon}${isTask ? '' : ` ${styles.content}`}`} title={isTask ? 'งาน' : 'คอนเทนต์'} aria-label={isTask ? 'งาน' : 'คอนเทนต์'}>
            {isTask ? <HiClipboardDocumentList /> : <HiDocumentText />}
          </span>
          <input className={styles.cell} value={title} aria-label="ชื่อ"
            onChange={e => setTitle(e.target.value)} onBlur={commitTitle}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setTitle(item.title); e.currentTarget.blur(); } }} />
        </div>
      </td>
      <td><Choice label="บริษัท" value={item.company || ''} options={COMPANIES.map(c => [c, c])} onChange={company => company && void save({ company })} /></td>
      <td><Choice label="ผู้รับผิดชอบ" value={item.memberId || ''} options={memberOptions} onChange={memberId => memberId && void save(withKpi({ memberId }, memberId, date || null))} /></td>
      <td><input type="date" className={styles.cell} value={when} aria-label="วันที่" title={date ? `เวลา ${format(new Date(date), 'HH:mm')} น. (แก้เวลาที่ดินสอ)` : undefined} onChange={e => setWhen(e.target.value)} onBlur={commitWhen} /></td>
      <td>{isTask ? <span className={styles.muted}>—</span> : (
        <div className={styles.stack}>
          <Choice label="แพลตฟอร์ม" value={item.platform || ''} options={PLATFORMS.map(p => [p, p])} onChange={platform => platform && void save(withKpi({ platform }, item.memberId, date || null, platform))} />
          <Choice label="รูปแบบ" value={item.contentType || ''} options={CONTENT_TYPES} onChange={type => type && void save({ type })} />
        </div>
      )}</td>
      <td>
        {multiKpi ? <span className={styles.muted}>{parseKpiIds(kpiId).length} KPI (แก้ที่ดินสอ)</span> : (
          <Choice label="KPI" value={kpiId} placeholder={kpiOptions.length ? '— ไม่ผูก —' : 'ไม่มี KPI ที่ตรง'} disabled={!kpiOptions.length && !kpiId}
            options={kpiOptions.map(k => [k.id, k.name])} onChange={next => void save({ kpiId: next || null })} />
        )}
      </td>
      <td><Choice label="สถานะ" value={item.status} options={STATUSES} onChange={status => onStatusChange(item, status)} /></td>
      <td className={styles.actions}>
        <button type="button" className={styles.iconBtn} onClick={() => onOpen(item)} title="แก้ไขรายละเอียด/ลิงก์"><HiOutlinePencilSquare /></button>
        <button type="button" className={`${styles.iconBtn} ${styles.danger}`} onClick={() => onDelete(item)} title="ลบ"><HiOutlineTrash /></button>
      </td>
    </tr>
  );
}

function AddRow({ people, kpis, defaultMemberId, defaultCompany, onSaved }: {
  people: TeamMember[]; kpis: Kpi[]; defaultMemberId: string; defaultCompany: string; onSaved: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<'task' | 'content'>('task');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState(defaultCompany);
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [when, setWhen] = useState('');
  const [platform, setPlatform] = useState('');
  const [type, setType] = useState('');
  const [kpiId, setKpiId] = useState('');
  useEffect(() => { if (defaultMemberId) setMemberId(prev => prev || defaultMemberId); }, [defaultMemberId]);

  const iso = fromInput(when);
  // Content is always for named people; "ทุกคน" only applies to tasks.
  const assignee = kind === 'content' && parseSelection(memberId).includes('all') ? '' : memberId;
  const kpiOptions = kind === 'task' ? taskKpiOptions(kpis, assignee, iso) : contentKpiOptions(kpis, assignee, iso, platform);
  // A KPI no longer offered (other person, month or platform) is dropped rather than saved.
  const chosenKpi = kpiOptions.some(k => k.id === kpiId) ? kpiId : '';

  const missing = [
    !title.trim() && 'ชื่อ', !company && 'บริษัท', !assignee && 'ผู้รับผิดชอบ', !iso && 'วันที่',
    ...(kind === 'content' ? [!platform && 'แพลตฟอร์ม', !type && 'รูปแบบ', kpiOptions.length > 0 && !chosenKpi && 'KPI'] : []),
  ].filter(Boolean) as string[];

  // The name is cleared as soon as a row is sent, so a repeated Enter or double click finds it
  // empty and adds nothing (no message: an empty name just means "nothing to add").
  const submit = async () => {
    if (!title.trim()) return;
    if (missing.length) { toast.error(`กรอกให้ครบ: ${missing.join(', ')}`); return; }
    const submitted = title.trim();
    const body = kind === 'task'
      ? { title: submitted, company, memberId: assignee, deadline: iso, priority: 'medium', status: 'todo', kpiId: chosenKpi ? validTaskKpiIds(kpis, assignee, iso, chosenKpi) : null }
      : { title: submitted, company, memberId: assignee, publishDate: iso, platform, type, status: 'todo', kpiId: chosenKpi || null };
    // Clear the name at once so the next row can be typed while this one saves;
    // who/when/where stay, so the next row of the plan only needs a new name.
    setTitle('');
    titleRef.current?.focus();
    try {
      await requireOk(fetchWorkspace(kind === 'task' ? '/api/tasks' : '/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }));
      onSaved();
    } catch (err) {
      toast.error(`บันทึก "${submitted}" ไม่สำเร็จ: ${saveErrorMessage(err)}`);
      setTitle(current => current || submitted);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } };
  const memberOptions: [string, string][] = [...(kind === 'task' ? [['all', 'ทุกคน'] as [string, string]] : []), ...people.map(m => [m.id, m.name] as [string, string])];

  return (
    <tr className={styles.addRow}>
      <td>
        <div className={styles.titleCell}>
          <span className={styles.kindToggle} role="group" aria-label="ประเภทรายการใหม่">
            <button type="button" aria-pressed={kind === 'task'} onClick={() => setKind('task')} title="งาน" aria-label="งาน"><HiClipboardDocumentList /></button>
            <button type="button" aria-pressed={kind === 'content'} onClick={() => setKind('content')} title="คอนเทนต์" aria-label="คอนเทนต์"><HiDocumentText /></button>
          </span>
          <input ref={titleRef} className={styles.cell} value={title} placeholder={kind === 'task' ? 'พิมพ์ชื่องาน แล้วกด Enter' : 'พิมพ์ชื่อคอนเทนต์ แล้วกด Enter'} aria-label="ชื่อรายการใหม่" onChange={e => setTitle(e.target.value)} onKeyDown={onEnter} />
        </div>
      </td>
      <td><Choice label="บริษัทรายการใหม่" value={company} placeholder="เลือก" options={COMPANIES.map(c => [c, c])} onChange={setCompany} /></td>
      <td><Choice label="ผู้รับผิดชอบรายการใหม่" value={assignee} placeholder="เลือก" options={memberOptions} onChange={setMemberId} /></td>
      <td><input type="date" className={styles.cell} value={when} aria-label="วันที่รายการใหม่" title={`ครบกำหนด ${NEW_ROW_TIME} น.`} onChange={e => setWhen(e.target.value)} onKeyDown={onEnter} /></td>
      <td>{kind === 'task' ? <span className={styles.muted}>—</span> : (
        <div className={styles.stack}>
          <Choice label="แพลตฟอร์มรายการใหม่" value={platform} placeholder="แพลตฟอร์ม" options={PLATFORMS.map(p => [p, p])} onChange={setPlatform} />
          <Choice label="รูปแบบรายการใหม่" value={type} placeholder="รูปแบบ" options={CONTENT_TYPES} onChange={setType} />
        </div>
      )}</td>
      <td>
        <Choice label="KPI รายการใหม่" value={chosenKpi} disabled={!kpiOptions.length}
          placeholder={kpiOptions.length ? (kind === 'content' ? 'เลือก (บังคับ)' : '— ไม่ผูก —') : (iso && memberId ? 'ไม่มี KPI ที่ตรง' : 'เลือกคน/วันก่อน')}
          options={kpiOptions.map(k => [k.id, k.name])} onChange={setKpiId} />
      </td>
      <td colSpan={2}>
        <button type="button" className={`btn btn-primary btn-sm ${styles.addBtn}`} onClick={() => void submit()} title={missing.length ? `ยังขาด: ${missing.join(', ')}` : 'เพิ่มรายการ'}>
          <HiPlus /> เพิ่ม
        </button>
      </td>
    </tr>
  );
}
