'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { HiArrowTopRightOnSquare, HiLockClosed, HiTableCells, HiPresentationChartLine } from 'react-icons/hi2';
import styles from './kpi-hub.module.css';
import { fetchWorkspace } from '@/lib/workspace-fetch';
import type { KpiHubState } from '@/lib/kpi-hub';

type Load = { status: 'loading' } | { status: 'error' } | KpiHubState;

/** KPI กลาง: links to the shared KPI sheet and dashboard, behind the page's own password. */
export default function KpiHubPage() {
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetchWorkspace('/api/kpi-hub');
      setState(response.ok ? await response.json() : { status: 'error' });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetchWorkspace('/api/kpi-hub', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        setState(body);
        setPassword('');
      } else {
        setError(body.error || 'เข้าไม่สำเร็จ ลองใหม่อีกครั้ง');
      }
    } catch {
      setError('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    await fetchWorkspace('/api/kpi-hub', { method: 'DELETE' }).catch(() => null);
    setState({ status: 'locked' });
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1>KPI กลาง</h1>
          <p className={styles.muted}>ชีตและแดชบอร์ด KPI ที่ทีมใช้ร่วมกัน</p>
        </div>
        {state.status === 'open' && (
          <button type="button" className="btn" onClick={lock}>
            <HiLockClosed aria-hidden /> ล็อกหน้านี้
          </button>
        )}
      </div>

      {state.status === 'loading' && <p className={styles.muted}>กำลังโหลด…</p>}
      {state.status === 'error' && (
        <div className={styles.panel}>
          <p>โหลดหน้านี้ไม่สำเร็จ</p>
          <button type="button" className="btn" onClick={() => { setState({ status: 'loading' }); void load(); }}>ลองใหม่</button>
        </div>
      )}
      {state.status === 'not-configured' && (
        <div className={styles.panel}>
          <p>ยังไม่ได้ตั้งรหัสของหน้านี้ ติดต่อผู้ดูแล</p>
        </div>
      )}

      {state.status === 'locked' && (
        <form className={styles.panel} onSubmit={unlock}>
          <HiLockClosed className={styles.lockIcon} aria-hidden />
          <label htmlFor="kpi-hub-password" className={styles.label}>ใส่รหัสเพื่อเข้าหน้า KPI กลาง</label>
          <input
            id="kpi-hub-password"
            className="form-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'kpi-hub-error' : undefined}
            autoFocus
          />
          {error && <p id="kpi-hub-error" className={styles.error} role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={!password || busy}>
            {busy ? 'กำลังตรวจ…' : 'เข้าใช้งาน'}
          </button>
          <p className={styles.hint}>ใส่ครั้งเดียว เครื่องนี้จำไว้ 7 วัน</p>
        </form>
      )}

      {state.status === 'open' && (
        <div className={styles.links}>
          <LinkCard
            href={state.links.sheetUrl}
            icon={<HiTableCells />}
            title="📊 ชีต KPI กลาง"
            text="เปิด Google Sheets ในแท็บใหม่"
            missing="ยังไม่ได้ใส่ลิงก์ชีต ติดต่อผู้ดูแล"
          />
          <LinkCard
            href={state.links.dashboardUrl}
            icon={<HiPresentationChartLine />}
            title="📈 แดชบอร์ด KPI"
            text="เปิดแดชบอร์ดในแท็บใหม่"
            missing="เร็ว ๆ นี้ — รอแดชบอร์ดจริงเสร็จ"
          />
        </div>
      )}
    </div>
  );
}

function LinkCard({ href, icon, title, text, missing }: {
  href: string | null; icon: ReactNode; title: string; text: string; missing: string;
}) {
  if (!href) {
    return (
      <div className={`${styles.card} ${styles.cardOff}`} aria-disabled="true">
        <span className={styles.cardIcon} aria-hidden>{icon}</span>
        <span className={styles.cardText}>
          <b>{title}</b>
          <small>{missing}</small>
        </span>
      </div>
    );
  }
  return (
    <a className={styles.card} href={href} target="_blank" rel="noopener noreferrer">
      <span className={styles.cardIcon} aria-hidden>{icon}</span>
      <span className={styles.cardText}>
        <b>{title}</b>
        <small>{text}</small>
      </span>
      <HiArrowTopRightOnSquare className={styles.cardArrow} aria-label="เปิดแท็บใหม่" />
    </a>
  );
}
