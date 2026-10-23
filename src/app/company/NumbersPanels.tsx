'use client';

import { useCallback, useState, type FormEvent } from 'react';
import styles from './company.module.css';
import { daysLeftInYear, type CompanyStats, type SalesRow } from '@/lib/company-stats';

const STATS_URL = '/api/admin/company-stats';
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// Brand colours per business (fixed by entity, never by rank). Each mark also carries a text label.
function businessColor(name: string): string {
  if (name.startsWith('GFS B2B')) return '#1b437c';
  if (name.startsWith('GFS')) return '#034aad';
  if (name.startsWith('MHL CAR')) return '#c8202f';
  if (name.startsWith('MHL')) return '#c2620a';
  return 'var(--color-primary)';
}

const baht = (value: number) => Math.round(value).toLocaleString('th-TH');
const millions = (value: number) => (value / 1e6).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
/** "2026-10-22" → "22 ต.ค. 69"; any time after the date ("2026-10-23 07:25") is kept. */
const thaiDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(value);
  return match ? `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${String(Number(match[1]) + 543).slice(2)}${match[4]}` : value;
};

type State =
  | { status: 'idle' | 'loading' | 'locked' }
  | { status: 'ready'; stats: CompanyStats }
  | { status: 'error'; code: string; serviceAccount?: string };

/** Loads the confidential figures once; both number tabs share the result. */
export function useCompanyStats() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const response = await fetch(STATS_URL, { cache: 'no-store' });
      if (response.status === 401) return setState({ status: 'locked' });
      const body = await response.json();
      if (!response.ok) return setState({ status: 'error', code: body.error || 'unavailable', serviceAccount: body.serviceAccount });
      setState({ status: 'ready', stats: body as CompanyStats });
    } catch {
      setState({ status: 'error', code: 'network' });
    }
  }, []);
  const lock = useCallback(async () => {
    await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => undefined);
    setState({ status: 'locked' });
  }, []);
  return { state, load, lock };
}

function errorMessage(code: string, serviceAccount?: string) {
  switch (code) {
    case 'sheet_access':
      return `เว็บยังเปิดชีตสรุปไม่ได้ ให้เจ้าของชีตแชร์ชีต "Good Group · ยอดใช้โฆษณา" ให้ ${serviceAccount || 'บัญชีบริการของเว็บ'} เป็นผู้มีสิทธิ์อ่าน`;
    case 'not_configured':
      return 'ยังไม่ได้ตั้งค่าการเชื่อมชีตบนเซิร์ฟเวอร์ (COMPANY_STATS_SHEET_ID หรือบัญชี Google)';
    case 'sheet_format':
      return 'รูปแบบชีตสรุปเปลี่ยนไป เว็บอ่านตัวเลขไม่ได้ กรุณาแจ้งผู้ดูแลระบบ';
    default:
      return 'โหลดตัวเลขไม่สำเร็จ กรุณาลองใหม่';
  }
}

function PasswordGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (checking) return;
    setChecking(true);
    try {
      // Checked on the server against ADMIN_PASSWORD; the cookie it sets unlocks the figures for 1 hour.
      const response = await fetch('/api/admin/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      if (response.ok) { setPassword(''); onUnlocked(); }
      else setError(response.status === 503 ? 'ยังไม่ได้ตั้งรหัสผู้ดูแลระบบบนเซิร์ฟเวอร์' : 'รหัสผ่านไม่ถูกต้อง');
    } catch {
      setError('ตรวจรหัสผ่านไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setChecking(false);
    }
  };
  return (
    <form className={styles.gate} onSubmit={submit}>
      <h3>ตัวเลขยอดขายและค่าโฆษณาเป็นข้อมูลลับ</h3>
      <p className={styles.muted}>ใส่รหัส Admin เพื่อดู (เปิดค้างได้ 1 ชั่วโมง)</p>
      <label className={styles.gateRow}>
        <span className={styles.srOnly}>รหัส Admin</span>
        <input type="password" className="form-input" autoComplete="current-password" required value={password}
          onChange={event => { setPassword(event.target.value); setError(''); }} placeholder="รหัส Admin" />
        <button type="submit" className="btn btn-primary" disabled={checking}>{checking ? 'กำลังตรวจ...' : 'ดูตัวเลข'}</button>
      </label>
      {error && <div className={styles.gateError} role="alert">{error}</div>}
    </form>
  );
}

function SourceNote({ stats, onLock }: { stats: CompanyStats; onLock: () => void }) {
  return (
    <div className={styles.hint}>
      ข้อมูลถึง {thaiDate(stats.dataThrough)} · ชีตอัปเดตเมื่อ {thaiDate(stats.updatedAt)} น. · ที่มา: ชีต “Good Group · ยอดใช้โฆษณา {stats.year + 543}” (มะลิอัปเดตทุกเช้า) · เว็บดึงใหม่ทุก 30 นาที
      {' '}<button type="button" className={styles.linkButton} onClick={onLock}>ล็อกตัวเลข</button>
    </div>
  );
}

function AdsView({ stats }: { stats: CompanyStats }) {
  const used = stats.budgets.reduce((sum, row) => sum + row.used, 0);
  const budget = stats.budgets.reduce((sum, row) => sum + row.budget, 0);
  return (
    <>
      <div className={styles.mcard}>
        <h3>ค่าโฆษณา · งบทั้งปี vs ใช้จริง ปี {stats.year + 543}</h3>
        <div className={styles.bigline}>
          <small className={styles.muted}>ใช้จริงถึง {thaiDate(stats.dataThrough)}</small>
          <strong>{baht(used)} บาท</strong>
          <small className={styles.muted}>จากงบ {baht(budget)}</small>
        </div>
        <div className={styles.legend}>
          <span><i style={{ background: 'var(--color-text-secondary)' }} />แถบสี = ใช้ไปแล้ว</span>
          <span><i className={styles.legendMark} />เส้นดำ = เวลาผ่านไป {percent(stats.yearPct)} ของปี</span>
        </div>
        <div className={styles.bars}>
          {stats.budgets.map(row => {
            const fast = row.usedPct > stats.yearPct;
            return (
              <div key={row.business} className={styles.brow}>
                <span className={styles.browLabel}>{row.business}</span>
                <div className={styles.btrack} title={`${row.business} ใช้ ${baht(row.used)} จาก ${baht(row.budget)} บาท`}>
                  <div className={styles.bfill} style={{ width: `${Math.min(100, row.usedPct * 100)}%`, background: businessColor(row.business) }}>{percent(row.usedPct)}</div>
                  <span className={styles.mark} style={{ left: `${stats.yearPct * 100}%` }} />
                </div>
                <span className={styles.bsub}>
                  ใช้ {baht(row.used)} / {baht(row.budget)} · เหลือ {baht(row.left)}{' '}
                  <span className={fast ? styles.stWarn : styles.stOk}>{fast ? 'ใช้เร็วกว่าเวลา' : 'ใช้ช้ากว่าเวลา'}</span>
                  {' '}· ปีที่แล้วทั้งปี {baht(row.lastYear)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.mcard}>
        <h3>ค่าโฆษณาที่ใช้จริง · แยกช่องทาง</h3>
        <div className={styles.tableWrap} style={{ border: 0 }}>
          <table className={`${styles.table} ${styles.mini}`}>
            <thead>
              <tr><th>ธุรกิจ</th><th>ช่องทาง</th><th>เดือนนี้</th><th>ทั้งปี {stats.year + 543} (ถึง {thaiDate(stats.dataThrough)})</th><th>ปี {stats.year + 542} ทั้งปี</th></tr>
            </thead>
            <tbody>
              {stats.adSpend.map(row => (
                <tr key={`${row.business}-${row.channel}`}>
                  <th scope="row"><span className={styles.dot} style={{ background: businessColor(row.business), display: 'inline-block', marginRight: 6 }} />{row.business}</th>
                  <th scope="row">{row.channel}</th>
                  <td>{baht(row.month)}</td><td>{baht(row.ytd)}</td><td>{baht(row.lastYear)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <small className={styles.muted}>หน่วยบาท · เดือนนี้ = 1 ถึง {thaiDate(stats.dataThrough)} · TikTok / LINE Ads ยังไม่เชื่อม</small>
      </div>
    </>
  );
}

function MonthlyChart({ row, partialMonth }: { row: SalesRow; partialMonth: number }) {
  const W = 300, H = 200, pt = 22, pb = 28, cw = W / 12;
  const monthTarget = row.target / 12;
  const values = row.monthly.map(v => v ?? 0);
  const max = Math.max(monthTarget, ...values) * 1.18 || 1;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const color = businessColor(row.business);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`ยอดขายรายเดือน ${row.business} เทียบเป้าต่อเดือน ${millions(monthTarget)} ล้าน`}>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-border)" />
      <line x1={0} x2={W} y1={y(monthTarget)} y2={y(monthTarget)} stroke="var(--color-text-primary)" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.55} />
      {row.monthly.map((value, i) => {
        if (value == null) return null;
        const x = i * cw + 2, w = cw - 4, partial = i === partialMonth;
        const top = y(value), height = Math.max(0, y(0) - top);
        return (
          <g key={i}>
            <title>{`${MONTHS[i]} ${baht(value)} บาท${partial ? ' (ยังไม่ครบเดือน)' : ''}`}</title>
            {/* Rounded top, square base anchored on the axis. */}
            <path d={`M${x},${y(0)} V${top + Math.min(4, height)} Q${x},${top} ${x + Math.min(4, w / 2)},${top} H${x + w - Math.min(4, w / 2)} Q${x + w},${top} ${x + w},${top + Math.min(4, height)} V${y(0)} Z`}
              fill={color} opacity={partial ? 0.45 : 1} />
            <text x={x + w / 2} y={top - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--color-text-primary)">{millions(value)}{partial ? '*' : ''}</text>
          </g>
        );
      })}
      {MONTHS.map((m, i) => <text key={m} x={i * cw + cw / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--color-text-secondary)">{m}</text>)}
    </svg>
  );
}

function SalesView({ stats }: { stats: CompanyStats }) {
  const daysLeft = daysLeftInYear(stats.dataThrough);
  const [, m, d] = stats.dataThrough.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(stats.year, m, 0)).getUTCDate();
  const partialMonth = d < monthEnd ? m - 1 : -1;
  return (
    <div className={styles.sgrid}>
      {stats.sales.map(row => {
        const pct = row.sold / row.target;
        const should = row.target * stats.yearPct;
        const gap = row.sold - should;
        const left = Math.max(0, row.target - row.sold);
        const behind = gap < 0;
        const tag = !behind ? ['เกินแผน', styles.stOk] : Math.abs(gap) / row.target > 0.05 ? ['ช้ากว่าแผน', styles.stWarn] : ['ใกล้ตามแผน', styles.stOk];
        const color = businessColor(row.business);
        return (
          <div key={row.business} className={styles.scard}>
            <div className={styles.shead}>
              <span className={styles.dot} style={{ background: color }} />
              <h3>{row.business}</h3>
              <span className={tag[1]}>{tag[0]}</span>
            </div>
            <div className={styles.bigline}>
              <small className={styles.muted}>ขายได้แล้ว</small>
              <strong>{millions(row.sold)} ล้าน</strong>
              <small className={styles.muted}>จากเป้า {millions(row.target)} ล้าน</small>
            </div>
            <div className={styles.ptrack} title={`ขายได้ ${percent(pct)} ของเป้า`}>
              <div className={styles.pfill} style={{ width: `${Math.min(100, pct * 100)}%`, background: color }}>{percent(pct)}</div>
              <div className={styles.pmark} style={{ left: `${stats.yearPct * 100}%` }}><span>ควรถึง {millions(should)} ล.</span></div>
            </div>
            <div className={styles.facts}>
              <div><span>{behind ? 'ขาดจากแผน ณ วันนี้' : 'เกินแผน ณ วันนี้'}</span><b>{millions(Math.abs(gap))} ล้าน</b></div>
              <div><span>ยังต้องขายอีกถึงเป้าทั้งปี</span><b>{millions(left)} ล้าน</b></div>
              <div><span>ต้องขายเฉลี่ยต่อเดือนจากนี้ถึงสิ้นปี</span><b>{millions(left / daysLeft * 30)} ล้าน</b></div>
              <div><span>ขายได้เดือนนี้</span><b>{baht(row.soldThisMonth)} บาท</b></div>
              {row.adPctOfSales != null && <div><span>ค่าโฆษณาคิดเป็น % ของยอดขาย</span><b>{percent(row.adPctOfSales)}</b></div>}
            </div>
            <div className={styles.chart}>
              <small className={styles.muted}>ยอดขายรายเดือน (ล้านบาท) · เส้นประ = เป้าต่อเดือน{partialMonth >= 0 ? ` · * ${MONTHS[partialMonth]} ยังไม่ครบเดือน` : ''}</small>
              <MonthlyChart row={row} partialMonth={partialMonth} />
              <details className={styles.dataTable}>
                <summary>ดูเป็นตาราง</summary>
                <table className={`${styles.table} ${styles.mini}`}>
                  <tbody>
                    {row.monthly.map((value, i) => value == null ? null : (
                      <tr key={i}><th scope="row">{MONTHS[i]}</th><td>{baht(value)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function NumbersPanel({ view, stats: { state, load, lock } }: { view: 'ads' | 'sales'; stats: ReturnType<typeof useCompanyStats> }) {
  if (state.status === 'idle' || state.status === 'loading') return <div className={styles.hint}>กำลังโหลดตัวเลข...</div>;
  if (state.status === 'locked') return <PasswordGate onUnlocked={load} />;
  if (state.status === 'error') {
    return (
      <div className={styles.gate} role="alert">
        <p>{errorMessage(state.code, state.serviceAccount)}</p>
        <button type="button" className="btn btn-secondary" onClick={load}>ลองใหม่</button>
      </div>
    );
  }
  if (state.status !== 'ready') return null;
  return (
    <>
      {view === 'ads' ? <AdsView stats={state.stats} /> : <SalesView stats={state.stats} />}
      <SourceNote stats={state.stats} onLock={lock} />
    </>
  );
}
