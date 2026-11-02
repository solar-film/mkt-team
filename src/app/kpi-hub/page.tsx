'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  HiChartBar, HiCheckBadge, HiChevronLeft, HiChevronRight, HiClock, HiInformationCircle, HiMegaphone, HiPencilSquare, HiSparkles, HiXMark,
} from 'react-icons/hi2';
import styles from './kpi-hub.module.css';
import MemberAvatar from '@/components/MemberAvatar';
import { fetchWorkspace } from '@/lib/workspace-fetch';
import { bangkokDateKey } from '@/lib/bangkok-date';
import { kpiScore, percent, type KpiHubSummary, type MemberSummary, type Ratio } from '@/lib/kpi-summary';
import type { ReachPost } from '@/app/api/kpi-hub/reach/route';

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
// November 2569 is the baseline month: numbers are collected, no target yet (team decision 1 Nov 69).
const BASELINE = { year: 2026, month: 11 };

const NO_DATA = 'ยังไม่มีข้อมูล';
const ratioText = (ratio: Ratio) => (ratio.total ? `${percent(ratio)}% (${ratio.done}/${ratio.total})` : NO_DATA);
const thaiDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${(y + 543) % 100}`;
};

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: KpiHubSummary };
type DrillTarget = { memberId: string; name: string };

export default function KpiHubPage() {
  const [period, setPeriod] = useState<{ year: number; month: number } | null>(null);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [drill, setDrill] = useState<DrillTarget | null>(null);

  useEffect(() => {
    // Thai "today" is read in the browser so the default month never differs from the server render.
    const today = bangkokDateKey(new Date());
    setPeriod({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  }, []);

  const fetchMonth = useCallback(async (year: number, month: number) => {
    setLoad({ status: 'loading' });
    try {
      const response = await fetchWorkspace(`/api/kpi-hub?year=${year}&month=${month}`);
      setLoad(response.ok ? { status: 'ready', data: await response.json() } : { status: 'error' });
    } catch {
      setLoad({ status: 'error' });
    }
  }, []);

  useEffect(() => { if (period) void fetchMonth(period.year, period.month); }, [period, fetchMonth]);

  if (!period) return null;
  const shift = (delta: number) => {
    const index = period.year * 12 + period.month - 1 + delta;
    setPeriod({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  };
  const isBaseline = period.year === BASELINE.year && period.month === BASELINE.month;

  return (
    <div className={styles.page}>
      <div className="page-header">
        <div className="page-header-content">
          <h1>สรุปผลงาน &amp; ประเมิน</h1>
          <p className={styles.muted}>ผลงานทีมการตลาด ส่งตรงเวลา · คุณภาพ · ผลคอนเทนต์ · KPI รายคน · ประเมินโดยมะลิ (AI)</p>
        </div>
        <div className={styles.headerActions}>
          {/* เป้าหมาย KPI left the main menu; it is reached from here. */}
          <Link href="/kpis" className="btn btn-secondary"><HiChartBar aria-hidden /> เป้าหมาย KPI</Link>
          <div className={styles.monthPicker} role="group" aria-label="เลือกเดือน">
            <button type="button" className={styles.iconButton} onClick={() => shift(-1)} aria-label="เดือนก่อน"><HiChevronLeft /></button>
            <span className={styles.monthLabel}>{THAI_MONTHS[period.month - 1]} {period.year + 543}</span>
            <button type="button" className={styles.iconButton} onClick={() => shift(1)} aria-label="เดือนถัดไป"><HiChevronRight /></button>
          </div>
        </div>
      </div>

      {isBaseline && (
        <p className={styles.notice}>
          <HiInformationCircle aria-hidden />
          <span>พ.ย. 69 เป็นเดือนเก็บฐาน (baseline) ของตัวชี้วัดใหม่ ยังไม่ตั้งเป้าและยังไม่หักคะแนน · KPI เดิมประเมินตามปกติ</span>
        </p>
      )}

      {load.status === 'loading' && <p className={styles.muted}>กำลังโหลด…</p>}
      {load.status === 'error' && (
        <div className={styles.card}>
          <p>โหลดข้อมูลไม่สำเร็จ</p>
          <button type="button" className="btn" onClick={() => void fetchMonth(period.year, period.month)}>ลองใหม่</button>
        </div>
      )}
      {load.status === 'ready' && <Report data={load.data} onDrill={setDrill} />}
      {drill && period && (
        <ReachDrillModal
          name={drill.name}
          memberId={drill.memberId}
          year={period.year}
          month={period.month}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}

function Report({ data, onDrill }: { data: KpiHubSummary; onDrill: (t: DrillTarget) => void }) {
  const { team, members } = data;
  const published = team.published.organic + team.published.paid + team.published.unknown;
  return (
    <>
      <section className={styles.stats} aria-label="ภาพรวมทีม">
        <StatTile
          icon={<HiClock />} label="ส่งงานตรงเวลา" value={percent(team.onTime)}
          detail={team.onTime.total ? `${team.onTime.done} จาก ${team.onTime.total} งานที่ถึงกำหนด` : NO_DATA}
          note={data.countedThrough < data.trackingStart
            ? `เริ่มบันทึกวันส่งจริง ${thaiDay(data.trackingStart)} เดือนก่อนหน้านั้นจึงไม่มีข้อมูล`
            : `นับถึง ${thaiDay(data.countedThrough)}${team.waiting ? ` · แยกงานรอข้อมูล/รออนุมัติ ${team.waiting} งาน` : ''}`}
        />
        <StatTile
          icon={<HiCheckBadge />} label="ผ่านบรีฟรอบแรก" value={percent(team.firstPass)}
          detail={team.firstPass.total ? `${team.firstPass.done} จาก ${team.firstPass.total} งานที่ตรวจแล้ว` : NO_DATA}
          note="แก้เพราะเปลี่ยนบรีฟ ไม่นับเป็นข้อผิดพลาด"
        />
        <StatTile
          icon={<HiMegaphone />} label="คอนเทนต์เผยแพร่" value={published || null} unit="ชิ้น"
          detail={published ? `Organic ${team.published.organic} · Paid ${team.published.paid}${team.published.unknown ? ` · ยังไม่ระบุ ${team.published.unknown}` : ''}` : NO_DATA}
          note="คอนเทนต์สถานะเสร็จแล้ว ที่วันเผยแพร่อยู่ในเดือนนี้"
        />
      </section>

      <section className={styles.charts}>
        <QualityChart members={members} />
        <ReachChart members={members} onDrill={onDrill} />
      </section>

      <MemberTable members={members} onDrill={onDrill} />
      <KpiCards members={members} />
      <Evaluations members={members} />
    </>
  );
}

function StatTile({ icon, label, value, unit = '%', detail, note }: {
  icon: React.ReactNode; label: string; value: number | null; unit?: string; detail: string; note: string;
}) {
  return (
    <article className={styles.stat}>
      <header><span className={styles.statIcon} aria-hidden>{icon}</span>{label}</header>
      <p className={styles.statValue}>{value === null ? '—' : <>{value}<small>{unit}</small></>}</p>
      <p className={styles.statDetail}>{detail}</p>
      <p className={styles.statNote}>{note}</p>
    </article>
  );
}

interface TipPayload { name: string; value: number | null; color: string }
function ChartTip({ active, label, payload, unit }: { active?: boolean; label?: string; payload?: TipPayload[]; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tip}>
      <b>{label}</b>
      {payload.map(p => (
        <span key={p.name}><i style={{ background: p.color }} aria-hidden />{p.name} <b>{p.value === null ? NO_DATA : `${p.value.toLocaleString('th-TH')}${unit}`}</b></span>
      ))}
    </div>
  );
}

function QualityChart({ members }: { members: MemberSummary[] }) {
  const rows = members.map(m => ({ name: m.name, onTime: percent(m.onTime), firstPass: percent(m.firstPass) }));
  const empty = rows.every(r => r.onTime === null && r.firstPass === null);
  return (
    <article className={styles.card}>
      <h2>ส่งตรงเวลา vs ผ่านบรีฟรอบแรก</h2>
      <p className={styles.muted}>รายคน (%) · คนที่ยังไม่มีงานถึงกำหนดจะไม่มีแท่ง</p>
      {empty ? <p className={styles.empty}>{NO_DATA}</p> : (
        <div className={styles.chart} role="img" aria-label="กราฟส่งตรงเวลาและผ่านบรีฟรอบแรกรายคน">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} barGap={2} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} interval={0} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} fontSize={11} width={32} />
              <Tooltip content={<ChartTip unit="%" />} cursor={{ fill: 'rgba(3,74,173,0.05)' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} itemSorter={null} />
              <Bar dataKey="onTime" name="ส่งตรงเวลา" fill="var(--kpi-series-1)" radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Bar dataKey="firstPass" name="ผ่านรอบแรก" fill="var(--kpi-series-2)" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}

function ReachChart({ members, onDrill }: { members: MemberSummary[]; onDrill: (t: DrillTarget) => void }) {
  // One series: few posts are marked organic/paid yet, so splitting would hide most of them.
  const rows = members.map(m => ({ name: m.name, all: m.reach7.all, memberId: m.memberId, posts: m.reach7.posts }));
  const empty = rows.every(r => r.all === null);
  const handleBarClick = (data: unknown) => {
    const d = data as { activePayload?: { payload: (typeof rows)[number] }[] } | null;
    const p = d?.activePayload?.[0]?.payload;
    if (p?.all != null && p.posts > 0) onDrill({ memberId: p.memberId, name: p.name });
  };
  return (
    <article className={styles.card}>
      <h2>Reach เฉลี่ยต่อโพสต์ @ 7 วัน</h2>
      <p className={styles.muted}>เทียบโพสต์ที่อายุครบ 7 วันเท่ากัน · Facebook ดึงอัตโนมัติจากเพจ ช่องทางอื่นกรอกเอง · ยังไม่ตั้งเป้า (เฟส 2) · <b>คลิกแท่งเพื่อดูรายชิ้น</b></p>
      {empty ? <p className={styles.empty}>ยังไม่มีสถิติ D+7 ของคอนเทนต์เดือนนี้</p> : (
        <div className={styles.chart} role="img" aria-label="กราฟ Reach เฉลี่ยต่อโพสต์ที่ 7 วันรายคน">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} barGap={2} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} onClick={handleBarClick} className={styles.reachBarClickable}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} interval={0} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} tickFormatter={v => Number(v).toLocaleString('th-TH', { notation: 'compact' })} />
              <Tooltip content={<ChartTip unit="" />} cursor={{ fill: 'rgba(3,74,173,0.08)' }} />
              <Bar dataKey="all" name="Reach เฉลี่ย" fill="var(--kpi-series-1)" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}

function MemberTable({ members, onDrill }: { members: MemberSummary[]; onDrill: (t: DrillTarget) => void }) {
  return (
    <section className={styles.card}>
      <h2>ผลงานรายคน</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ผู้รับผิดชอบ</th><th>ส่งตรงเวลา</th><th>รอข้อมูล/อนุมัติ</th><th>ผ่านบรีฟรอบแรก</th>
              <th>Organic</th><th>Paid</th><th>Reach @7 วัน (เฉลี่ย)</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.memberId}>
                <th scope="row"><span className={styles.who}><MemberAvatar name={m.name} size="sm" />{m.name}</span></th>
                <td>{ratioText(m.onTime)}</td>
                <td>{m.waiting || '—'}</td>
                <td>{ratioText(m.firstPass)}</td>
                <td>{m.published.organic}</td>
                <td>{m.published.paid}</td>
                <td>
                  {m.reach7.all === null ? '—' : (
                    <button
                      type="button"
                      className={styles.drillBtn}
                      onClick={() => onDrill({ memberId: m.memberId, name: m.name })}
                    >
                      {m.reach7.all.toLocaleString('th-TH')} ({m.reach7.posts} โพสต์)
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.foot}>ข้อมูลมาจากหน้าจัดการงาน: กดงาน → ส่วน &quot;ผลงาน KPI&quot; · กดตัวเลข Reach เพื่อดูรายชิ้น · วันส่งจริงบันทึกเองเมื่อย้ายงานเป็นเสร็จแล้ว</p>
    </section>
  );
}

function KpiCards({ members }: { members: MemberSummary[] }) {
  const withKpis = members.filter(m => m.kpis.length);
  return (
    <section className={styles.card}>
      <div className={styles.sectionHead}>
        <h2>KPI เดิม (ปริมาณงานตามเป้า)</h2>
        <Link href="/kpis" className="btn"><HiPencilSquare aria-hidden /> แก้เป้าที่หน้าเดิม</Link>
      </div>
      {withKpis.length === 0 ? <p className={styles.empty}>ยังไม่มีเป้า KPI ของเดือนนี้</p> : (
        <div className={styles.kpiGrid}>
          {withKpis.map(m => {
            const score = kpiScore(m.kpis);
            const scorePct = percent(score);
            return (
            <article key={m.memberId} className={styles.kpiPerson}>
              <header className={styles.kpiHead}>
                <span className={styles.who}><MemberAvatar name={m.name} size="sm" /><b>{m.name}</b></span>
                {scorePct !== null && (
                  <span className={styles.kpiScore} title="คะแนน KPI = รวมผลงาน (ไม่เกินเป้าแต่ละข้อ) ÷ รวมเป้า">
                    <b className={scorePct >= 100 ? styles.scoreDone : undefined}>{scorePct}%</b>
                    <small>คะแนน KPI · {score.done}/{score.total}</small>
                  </span>
                )}
              </header>
              <ul>
                {m.kpis.map(k => {
                  const pct = k.target > 0 ? Math.round((k.current / k.target) * 100) : 0;
                  return (
                    <li key={k.id}>
                      <div className={styles.kpiLine}><span>{k.name}</span><b>{k.current}/{k.target} {k.unit}</b></div>
                      <div className={styles.bar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={k.name}>
                        <span style={{ width: `${Math.min(pct, 100)}%` }} className={pct >= 100 ? styles.barDone : undefined} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Evaluations({ members }: { members: MemberSummary[] }) {
  return (
    <section className={styles.card}>
      <div className={styles.sectionHead}>
        <h2><HiSparkles aria-hidden className={styles.spark} /> ประเมินโดยมะลิ (AI)</h2>
      </div>
      <p className={styles.muted}>มะลิอ่านตัวเลขในหน้านี้แล้วสรุปจุดเด่น สิ่งที่ควรพัฒนา และสิ่งที่ควรทำเดือนหน้า · ใช้ประกอบการคุยกัน ไม่ใช่คำตัดสินสุดท้าย</p>
      <div className={styles.evalGrid}>
        {members.map(m => (
          <article key={m.memberId} className={styles.evalCard}>
            <header className={styles.who}><MemberAvatar name={m.name} size="sm" /><b>{m.name}</b></header>
            {m.evaluation ? (
              <>
                <p>{m.evaluation.summary}</p>
                {m.evaluation.strengths && <EvalPart title="จุดเด่น" text={m.evaluation.strengths} tone="good" />}
                {m.evaluation.improvements && <EvalPart title="ควรพัฒนา" text={m.evaluation.improvements} tone="improve" />}
                {m.evaluation.nextSteps && <EvalPart title="เดือนหน้าลองทำ" text={m.evaluation.nextSteps} tone="next" />}
                <small className={styles.muted}>{m.evaluation.source} · อัปเดต {thaiDay(bangkokDateKey(m.evaluation.updatedAt))}</small>
              </>
            ) : <p className={styles.empty}>มะลิยังไม่ได้ประเมินเดือนนี้</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function EvalPart({ title, text, tone }: { title: string; text: string; tone: 'good' | 'improve' | 'next' }) {
  return (
    <div className={`${styles.evalPart} ${styles[tone]}`}>
      <b>{title}</b>
      <p>{text}</p>
    </div>
  );
}

type DrillLoad = { status: 'loading' } | { status: 'error' } | { status: 'ready'; posts: ReachPost[] };

function ReachDrillModal({ name, memberId, year, month, onClose }: {
  name: string; memberId: string; year: number; month: number; onClose: () => void;
}) {
  const [load, setLoad] = useState<DrillLoad>({ status: 'loading' });
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();
    void fetchWorkspace(`/api/kpi-hub/reach?year=${year}&month=${month}&memberId=${encodeURIComponent(memberId)}`)
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then((posts: ReachPost[]) => setLoad({ status: 'ready', posts }))
      .catch(() => setLoad({ status: 'error' }));
  }, [memberId, year, month]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isAuto = (source: string) => source === 'api' || source === 'windsor';

  return (
    <div className={styles.overlay} role="dialog" aria-modal aria-label={`Reach รายชิ้นของ ${name}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <h2>Reach D+7 รายชิ้น — {name}</h2>
          <button ref={closeBtnRef} type="button" className={styles.iconButton} onClick={onClose} aria-label="ปิด"><HiXMark /></button>
        </div>
        <div className={styles.modalBody}>
          {load.status === 'loading' && <p className={styles.muted} style={{ padding: '1rem 1.1rem' }}>กำลังโหลด…</p>}
          {load.status === 'error' && <p className={styles.muted} style={{ padding: '1rem 1.1rem' }}>โหลดไม่สำเร็จ</p>}
          {load.status === 'ready' && (
            load.posts.length === 0
              ? <p className={styles.empty} style={{ padding: '1rem 1.1rem' }}>ไม่มีโพสต์ที่มีข้อมูล Reach D+7 ในเดือนนี้</p>
              : (
                <ul className={styles.postList}>
                  {load.posts.map(p => (
                    <li key={p.id} className={styles.postRow}>
                      <div>
                        <p className={styles.postTitle}>{p.title}</p>
                        <p className={styles.postMeta}>
                          <span>{thaiDay(p.publishDate)}</span>
                          <span>·</span>
                          <span>{p.platform}</span>
                          {p.promotion && <><span>·</span><span>{p.promotion === 'organic' ? 'Organic' : 'Paid'}</span></>}
                          <span className={`${styles.sourceBadge} ${isAuto(p.source) ? '' : styles.sourceBadgeManual}`}>
                            {isAuto(p.source) ? 'ดึงอัตโนมัติ' : 'กรอกเอง'}
                          </span>
                        </p>
                      </div>
                      <div className={styles.postReach}>
                        {p.reach7.toLocaleString('th-TH')}
                        <br /><small style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>คน</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )
          )}
        </div>
      </div>
    </div>
  );
}
