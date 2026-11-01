'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { HiArrowLongRight, HiArrowPath, HiArrowTopRightOnSquare, HiBanknotes, HiClock, HiCalendarDays } from 'react-icons/hi2';
import styles from './sources.module.css';
import { fetchWorkspace } from '@/lib/workspace-fetch';
import { bangkokDateKey } from '@/lib/bangkok-date';
import {
  adsStatus, DATA_SOURCES, daysUntil, expiryStatus, sheetStatus, STATUS_LABEL, worst,
  type DataSource, type SourceStatus,
} from '@/lib/data-sources';
import type { DataSourcesLive } from '@/app/api/data-sources/route';

const PLATFORM_LABEL: Record<string, string> = { google_ads: 'Google', facebook: 'Facebook', openai_ads: 'ChatGPT' };
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** "2026-11-01" → "1 พ.ย. 69" */
function thaiDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return `${d} ${THAI_MONTHS[m - 1]} ${(y + 543) % 100}`;
}

/** Bangkok day and time of an ISO timestamp: "1 พ.ย. 69 06:02" */
function thaiDateTime(iso: string): string {
  const time = new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
  return `${thaiDate(bangkokDateKey(iso))} ${time}`;
}

interface SheetLive { updatedAt: string; dataThrough: string }
type Load<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error' };

interface Row { icon: ReactNode; label: string; value: ReactNode }
interface View { status: SourceStatus; pending: boolean; rows: Row[]; note?: string; todo?: string; link: string }

/** Combines the hand-written facts with live sync times and the expiry countdown. */
function view(source: DataSource, today: string, live: Load<DataSourcesLive>, sheet: Load<SheetLive>): View {
  let status = source.status;
  let when: ReactNode = source.when;
  let note: string | undefined;
  let link = source.link.url;

  let expires: ReactNode;
  if ('date' in source.expires) {
    const left = daysUntil(source.expires.date, today);
    status = worst(status, expiryStatus(left));
    expires = <><b className={styles.big}>{left > 0 ? `เหลือ ${left} วัน` : 'หมดแล้ว'}</b> <span>{source.expires.label}</span></>;
  } else {
    expires = source.expires.text;
  }

  if (source.live === 'ads') {
    if (live.status === 'ready') {
      const failed = live.data.ads.filter(ad => ad.lastAt && !ad.lastOk).map(ad => PLATFORM_LABEL[ad.platform] ?? ad.platform);
      const okTimes = live.data.ads.map(ad => ad.lastOkAt).filter((at): at is string => Boolean(at)).sort();
      const lastOk = okTimes.at(-1) ?? null;
      const oldestOk = okTimes.length === live.data.ads.length ? okTimes[0] : null;
      status = worst(status, adsStatus(oldestOk && bangkokDateKey(oldestOk), failed.length > 0, today));
      when = <>{source.when}<br /><small>ล่าสุดสำเร็จ {lastOk ? thaiDateTime(lastOk) : '—'}</small></>;
      if (!live.data.windsorConfigured) note = 'ยังไม่ได้ใส่ key ของ Windsor ในเว็บ';
      else if (failed.length) note = `ดึงล่าสุดไม่สำเร็จ: ${failed.join(', ')}`;
    } else if (live.status === 'error') {
      note = 'โหลดสถานะการดึงไม่สำเร็จ';
    }
  }

  if (source.live === 'sheet') {
    if (live.status === 'ready' && live.data.sheetUrl) link = live.data.sheetUrl;
    if (sheet.status === 'ready') {
      const behind = daysUntil(today, sheet.data.dataThrough);
      status = worst(status, sheetStatus(sheet.data.dataThrough, today));
      when = <>{source.when}<br /><small>ชีตอัปเดตล่าสุด {sheet.data.updatedAt} · ข้อมูลถึง {thaiDate(sheet.data.dataThrough)}</small></>;
      if (behind > 3) note = `ชีตหยุดอัปเดตมา ${behind} วัน`;
    } else if (sheet.status === 'error') {
      status = worst(status, 'problem');
      note = 'เว็บอ่านชีตไม่สำเร็จ';
    }
  }

  const rows: Row[] = [
    { icon: <HiArrowPath />, label: 'ดึงเมื่อ', value: when },
    { icon: <HiCalendarDays />, label: 'อายุ', value: expires },
    { icon: <HiBanknotes />, label: 'ค่าใช้จ่าย', value: source.cost },
  ];
  if (source.usage) rows.push({ icon: <HiClock />, label: 'ใช้ไป', value: source.usage });
  // Until its live data arrives a card cannot say it is fine.
  const pending = (source.live === 'ads' && live.status === 'loading') || (source.live === 'sheet' && sheet.status === 'loading');
  return { status, pending, rows, note, todo: status === 'ok' || pending ? undefined : source.todo, link };
}

export default function SourcesPage() {
  const [today, setToday] = useState<string | null>(null);
  const [live, setLive] = useState<Load<DataSourcesLive>>({ status: 'loading' });
  const [sheet, setSheet] = useState<Load<SheetLive>>({ status: 'loading' });

  const load = useCallback(async () => {
    setLive({ status: 'loading' });
    setSheet({ status: 'loading' });
    const [liveRes, sheetRes] = await Promise.allSettled([fetchWorkspace('/api/data-sources'), fetchWorkspace('/api/company-stats')]);
    if (liveRes.status === 'fulfilled' && liveRes.value.ok) setLive({ status: 'ready', data: await liveRes.value.json() });
    else setLive({ status: 'error' });
    if (sheetRes.status === 'fulfilled' && sheetRes.value.ok) {
      const stats = await sheetRes.value.json();
      setSheet({ status: 'ready', data: { updatedAt: stats.updatedAt, dataThrough: stats.dataThrough } });
    } else {
      setSheet({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    // Bangkok "today" is read in the browser so the countdown never differs from the server render.
    setToday(bangkokDateKey(new Date()));
    load();
  }, [load]);

  if (!today) return null;
  const views = DATA_SOURCES.map(source => ({ source, ...view(source, today, live, sheet) }));
  const todos = views.filter(v => !v.pending && (v.status === 'problem' || v.status === 'soon'));

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1>แหล่งข้อมูล</h1>
          <p className={styles.muted}>ข้อมูลในเว็บมาจากไหน หมดอายุเมื่อไร เสียเงินเท่าไร</p>
        </div>
      </div>

      {todos.length > 0 && (
        <section className={styles.todo} aria-label="ต้องจัดการ">
          <h2>ต้องจัดการ</h2>
          <ul>
            {todos.map(v => (
              <li key={v.source.id}>
                <span className={`${styles.dot} ${styles[v.status]}`} aria-hidden />
                <b>{v.source.name}</b> — {v.note ?? v.todo ?? STATUS_LABEL[v.status]}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.grid}>
        {views.map(({ source, status: known, pending, rows, note, todo, link }) => {
          const status = pending ? 'idle' : known;
          return (
          <article key={source.id} className={`${styles.card} ${styles[`card_${status}`]}`}>
            <header className={styles.head}>
              <h2>{source.name}</h2>
              <span className={`${styles.pill} ${styles[status]}`}>{pending ? 'กำลังตรวจ…' : STATUS_LABEL[status]}</span>
            </header>
            <p className={styles.what}>{source.what}</p>
            <div className={styles.flow}>
              <span>{source.from}</span>
              <HiArrowLongRight aria-label="ส่งไปที่" />
              <span>{source.to}</span>
            </div>
            <dl className={styles.rows}>
              {rows.map(row => (
                <div key={row.label}>
                  <dt>{row.icon}{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            {note && <p className={styles.note}>{note}</p>}
            {todo && todo !== note && <p className={styles.note}>{todo}</p>}
            <footer className={styles.foot}>
              <a href={link} target="_blank" rel="noopener noreferrer">
                {source.link.label} <HiArrowTopRightOnSquare aria-hidden />
              </a>
              <small>ตรวจ {thaiDate(source.checkedAt)}</small>
            </footer>
          </article>
          );
        })}
      </div>
    </div>
  );
}
