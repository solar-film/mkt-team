'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HiArrowPath, HiArrowUpTray, HiChatBubbleLeftRight, HiPhone, HiPresentationChartLine } from 'react-icons/hi2';
import { fetchWorkspace } from '@/lib/workspace-fetch';
import { change, daysInMonth, isMonthKey, monthLabel, shiftMonth, thaiMonthShort } from '@/lib/ads-data';
import {
  accountLines, CHANNEL_INFO, CHANNELS, COMPANIES, COMPANY_LABEL, companyChannelTable, dailyByChannel, DATASET_INFO, DATASETS, DEFAULT_DATASET, isChannel, isCompany,
  isDataset, monthContacts, monthlyByChannel, monthNew, sum, summarizeCallLog, weekdayAverages, yearOverYear,
  type CallLogSummary, type Channel, type Company, type ContactData, type Dataset, type Filter,
} from '@/lib/contact-data';
import styles from '../market/market.module.css';
import own from './contacts.module.css';

export type ContactsMode = 'overview' | 'analysis' | 'phone';

const SUBNAV: { href: string; label: string; mode: ContactsMode }[] = [
  { href: '/contacts', label: 'ภาพรวมการติดต่อ', mode: 'overview' },
  { href: '/contacts/analysis', label: 'วิเคราะห์', mode: 'analysis' },
  { href: '/contacts/phone', label: 'อัปโหลดข้อมูลโทร', mode: 'phone' },
];

const MODE_ICON: Record<ContactsMode, ReactNode> = {
  overview: <HiChatBubbleLeftRight />, analysis: <HiPresentationChartLine />, phone: <HiPhone />,
};

const count = (n: number | null) => (n === null ? '—' : Math.round(n).toLocaleString('th-TH'));
const one = (n: number | null) => (n === null ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 1 }));
const baht = (n: number | null) => (n === null ? '—' : `฿${Math.round(n).toLocaleString('th-TH')}`);
/** Sum that stays null when no value is known (e.g. phone lines have no "new customer" count). */
const sumOrNull = (values: (number | null)[]) => (values.some(v => v !== null) ? sum(values.map(v => v ?? 0)) : null);
const percent = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const dayLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const shiftDay = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

function Delta({ now, before, label }: { now: number | null; before: number | null; label: string }) {
  const c = change(now, before);
  if (c === null) return <span>{label}: ไม่มีข้อมูลเทียบ</span>;
  const flat = Math.abs(c) < 0.0005;
  // More contacts is the good direction.
  const cls = flat ? styles.flat : c > 0 ? styles.up : styles.down;
  return <span>{label}: <span className={cls}>{flat ? '•' : c > 0 ? '▲' : '▼'} {Math.abs(c * 100).toFixed(1)}%</span></span>;
}

function Tile({ label, value, notes }: { label: string; value: string; notes: ReactNode }) {
  return (
    <div className={`${styles.tile} ${styles.goodUp}`}>
      <div className={styles.tileLabel}>{label}</div>
      <div className={styles.tileValue}>{value}</div>
      <div className={styles.tileNote}>{notes}</div>
    </div>
  );
}

/** Last complete day of `month` for like-for-like comparisons: yesterday in the current month, else the month end. */
function completeDays(data: ContactData): number {
  const days = daysInMonth(data.month);
  if (data.today.slice(0, 7) !== data.month) return days;
  return Math.max(0, Number(data.today.slice(8)) - 1);
}

function Tiles({ data, filter }: { data: ContactData; filter: Filter }) {
  const yesterday = shiftDay(data.today, -1);
  const dayTotal = (date: string) => sum(data.rows.filter(r => r.date === date
    && (filter.company === 'all' || r.company === filter.company) && (filter.channel === 'all' || r.channel === filter.channel)).map(r => r.contacts));
  const upto = completeDays(data);
  const prev = shiftMonth(data.month, -1);
  const lastYear = shiftMonth(data.month, -12);
  const now = monthContacts(data.rows, data.month, filter, upto);
  const fresh = monthNew(data.rows, data.month, filter);
  const isCurrent = data.today.slice(0, 7) === data.month;
  // On the 1st no day of the month has finished yet: show today so far and skip the comparisons.
  const firstDay = isCurrent && upto === 0;
  return (
    <div className={styles.tiles}>
      {isCurrent && (
        <Tile
          label={`เมื่อวาน · ${dayLabel(yesterday)}`}
          value={count(dayTotal(yesterday))}
          notes={<><Delta now={dayTotal(yesterday)} before={dayTotal(shiftDay(yesterday, -7))} label="วันเดียวกันสัปดาห์ก่อน" /><span>วันนี้ถึงตอนนี้ {count(dayTotal(data.today))} คน</span></>}
        />
      )}
      <Tile
        label={!isCurrent ? `ทั้งเดือน ${monthLabel(data.month)}` : firstDay ? 'เดือนนี้ (วันนี้ถึงตอนนี้)' : `เดือนนี้ (ถึง ${dayLabel(yesterday)})`}
        value={count(firstDay ? monthContacts(data.rows, data.month, filter) : now)}
        notes={firstDay ? <span>วันแรกของเดือน ยังไม่มีวันที่จบสำหรับเทียบ</span> : <>
          <Delta now={now} before={monthContacts(data.rows, prev, filter, upto)} label="เดือนก่อนช่วงเดียวกัน" />
          <Delta now={now} before={monthContacts(data.rows, lastYear, filter, upto)} label="ปีก่อนช่วงเดียวกัน" />
        </>}
      />
      <Tile
        label="เฉลี่ยต่อวัน"
        value={upto ? one(now / upto) : '—'}
        notes={<span>นับ {upto} วันที่จบแล้ว</span>}
      />
      <Tile
        label={data.dataset === 'sheet' ? 'ลูกค้าใหม่ (ชีตแอดมิน)' : 'ลูกค้าใหม่ (แชท)'}
        value={count(fresh)}
        notes={<span>{fresh === null ? 'ช่องทางนี้ไม่แยกลูกค้าใหม่' : data.dataset === 'sheet' ? 'ตามที่แอดมินบันทึกต่อวัน · GFS / MHL อาคาร (CAR ไม่แยก)' : 'ทักครั้งแรกในเดือนนี้ · LINE / FB / IG'}</span>}
      />
    </div>
  );
}

function ChannelLegend({ channels }: { channels: readonly Channel[] }) {
  return (
    <div className={styles.legend}>
      {channels.map(c => <span key={c}><i className={styles.swatch} style={{ background: CHANNEL_INFO[c].color }} />{CHANNEL_INFO[c].label}</span>)}
    </div>
  );
}

const shownChannels = (filter: Filter) => CHANNELS.filter(c => filter.channel === 'all' || c === filter.channel);

function StackedTooltip({ active, payload, label, labelOf }: {
  active?: boolean; payload?: { dataKey?: string | number; value?: number | string }[]; label?: string | number; labelOf: (label: string | number) => string;
}) {
  if (!active || !payload?.length || label === undefined) return null;
  const items = payload.filter(p => isChannel(p.dataKey));
  return (
    <div className={own.tooltip}>
      <strong>{labelOf(label)}</strong>
      {[...items].reverse().map(p => (
        <span key={String(p.dataKey)}>
          <i className={styles.swatch} style={{ background: CHANNEL_INFO[p.dataKey as Channel].color }} />
          {CHANNEL_INFO[p.dataKey as Channel].label} <b>{count(Number(p.value))}</b>
        </span>
      ))}
      <span className={own.tooltipTotal}>รวม <b>{count(sum(items.map(p => Number(p.value))))}</b></span>
    </div>
  );
}

function DailyChart({ data, filter }: { data: ContactData; filter: Filter }) {
  const points = dailyByChannel(data.rows, data.month, daysInMonth(data.month), filter);
  const channels = shownChannels(filter);
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>การติดต่อรายวัน · {monthLabel(data.month)}</h2>
        <ChannelLegend channels={channels} />
      </div>
      <div className={styles.chart} role="img" aria-label={`จำนวนการติดต่อรายวันแยกช่องทาง ${monthLabel(data.month)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#eef0f3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={36} />
            <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} content={<StackedTooltip labelOf={d => `วันที่ ${d} ${monthLabel(data.month)}`} />} />
            {channels.map((c, i) => (
              <Bar key={c} dataKey={c} name={CHANNEL_INFO[c].label} stackId="contacts" fill={CHANNEL_INFO[c].color}
                stroke="var(--color-surface)" strokeWidth={1} maxBarSize={18}
                radius={i === channels.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className={styles.foot}>
        <summary>ดูเป็นตาราง</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>วันที่</th>{channels.map(c => <th key={c}>{CHANNEL_INFO[c].label}</th>)}<th>รวม</th></tr></thead>
            <tbody>
              {points.filter(p => Number(p.total) > 0).map(p => (
                <tr key={String(p.date)}>
                  <td>{dayLabel(String(p.date))}</td>
                  {channels.map(c => <td key={c}>{count(Number(p[c]))}</td>)}
                  <td>{count(sum(channels.map(c => Number(p[c]))))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function YearChart({ data, filter }: { data: ContactData; filter: Filter }) {
  const points = monthlyByChannel(data.monthly, data.month, filter).map(p => ({
    ...p, name: `${thaiMonthShort(Number(String(p.month).slice(5)))} ${String(Number(String(p.month).slice(0, 4)) + 543).slice(2)}`,
  }));
  const channels = shownChannels(filter);
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>การติดต่อรายเดือน · 13 เดือน</h2>
        <ChannelLegend channels={channels} />
      </div>
      <div className={styles.chart} role="img" aria-label="จำนวนการติดต่อรายเดือนแยกช่องทาง 13 เดือนล่าสุด">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#eef0f3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={40} />
            <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} content={<StackedTooltip labelOf={name => String(name)} />} />
            {channels.map((c, i) => (
              <Bar key={c} dataKey={c} name={CHANNEL_INFO[c].label} stackId="contacts" fill={CHANNEL_INFO[c].color}
                stroke="var(--color-surface)" strokeWidth={1} maxBarSize={28}
                radius={i === channels.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className={styles.foot}>เริ่มมีข้อมูลตั้งแต่ {data.firstMonth ? monthLabel(data.firstMonth) : '—'} · เดือนก่อนหน้านั้นยังไม่ได้เก็บ จึงเป็น 0</p>
    </section>
  );
}

/** Year-comparison pair: last year in warm brown, this year in the page's blue (validated as a categorical pair, light and dark). */
const YEAR_COLORS = { before: '#b45309', now: '#2a78d6' } as const;
const buddhistYear = (year: number) => String(year + 543);

function CompareTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey?: string | number; value?: number | string }[]; label?: string | number }) {
  if (!active || !payload?.length || label === undefined) return null;
  const pick = (key: string) => payload.find(p => p.dataKey === key)?.value;
  const before = pick('before');
  const now = pick('now');
  const point = (payload[0] as { payload?: { beforeLabel?: string; nowLabel?: string; nowKnown?: boolean } }).payload ?? {};
  return (
    <div className={own.tooltip}>
      <strong>{String(label)}</strong>
      <span><i className={styles.swatch} style={{ background: YEAR_COLORS.before }} />{point.beforeLabel} <b>{count(Number(before ?? 0))}</b></span>
      <span><i className={styles.swatch} style={{ background: YEAR_COLORS.now }} />{point.nowLabel} <b>{point.nowKnown ? count(Number(now ?? 0)) : '—'}</b></span>
      {point.nowKnown && <span className={own.tooltipTotal}><Delta now={Number(now ?? 0)} before={Number(before ?? 0)} label="เปลี่ยน" /></span>}
    </div>
  );
}

/** Each month of the selected year beside the same month a year earlier, with a like-for-like year-to-date line. */
function YearCompareCard({ data, filter }: { data: ContactData; filter: Filter }) {
  const year = Number(data.month.slice(0, 4));
  const points = yearOverYear(data.monthly, year, data.today, filter);
  const labels = { before: buddhistYear(year - 1), now: buddhistYear(year) };
  const chart = points.map(p => ({
    name: thaiMonthShort(p.month), before: p.before ?? 0, now: p.now ?? 0, nowKnown: p.now !== null, beforeLabel: labels.before, nowLabel: labels.now,
  }));
  const hasBefore = points.some(p => (p.before ?? 0) > 0);
  // Finished months only, so a month in progress never drags the year-to-date figure down.
  const done = points.filter(p => p.now !== null && p.key < data.today.slice(0, 7));
  const ytdNow = sum(done.map(p => p.now ?? 0));
  const ytdBefore = sum(done.map(p => p.before ?? 0));
  const span = done.length === 12 ? `ทั้งปี ${labels.now}` : done.length ? `ม.ค.–${thaiMonthShort(done.length)} ${labels.now}` : '';
  // goodUp: more contacts is the good direction, so a drop reads as a warning here as it does on the tiles.
  return (
    <section className={`${styles.card} ${styles.goodUp}`}>
      <div className={styles.cardHead}>
        <h2>เทียบรายเดือน · ปี {labels.now} กับ {labels.before}</h2>
        <div className={styles.legend}>
          <span><i className={styles.swatch} style={{ background: YEAR_COLORS.before }} />{labels.before}</span>
          <span><i className={styles.swatch} style={{ background: YEAR_COLORS.now }} />{labels.now}</span>
        </div>
      </div>
      {!hasBefore ? (
        <p className={styles.foot}>
          ยังไม่มีข้อมูลปี {labels.before} ให้เทียบ{data.dataset === 'live' ? ' · ชุด GOOD CRM เริ่มเก็บ ก.ย. 2569 — เลือกชุด ชีตแอดมิน เพื่อเทียบย้อนหลัง' : ''}
        </p>
      ) : (
        <>
          <div className={styles.chart} role="img" aria-label={`จำนวนการติดต่อรายเดือน ปี ${labels.now} เทียบปี ${labels.before}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#eef0f3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={40} />
                <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} content={<CompareTooltip />} />
                <Bar dataKey="before" name={labels.before} fill={YEAR_COLORS.before} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="now" name={labels.now} fill={YEAR_COLORS.now} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className={styles.foot}>
            {span ? <>{span} รวม <b>{count(ytdNow)}</b> เทียบ {count(ytdBefore)} ในปี {labels.before} · <Delta now={ytdNow} before={ytdBefore} label="เปลี่ยน" /> · </> : 'ยังไม่มีเดือนที่จบในปีนี้ · '}
            นับเฉพาะเดือนที่จบแล้ว เดือนปัจจุบันยังไม่ครบจึงไม่รวม
          </p>
          <details className={styles.foot}>
            <summary>ดูเป็นตาราง</summary>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>เดือน</th><th>ปี {labels.before}</th><th>ปี {labels.now}</th><th>เปลี่ยน</th></tr></thead>
                <tbody>
                  {points.map(p => (
                    <tr key={p.key}>
                      <td>{thaiMonthShort(p.month)}</td>
                      <td>{count(p.before)}</td>
                      <td>{count(p.now)}</td>
                      <td>{p.now === null || p.before === null ? '—' : <>{p.now - p.before >= 0 ? '+' : ''}{count(p.now - p.before)} <Delta now={p.now} before={p.before} label="" /></>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td>{span || 'ยังไม่มีเดือนที่จบ'}</td><td>{count(ytdBefore)}</td><td>{count(ytdNow)}</td><td>{done.length ? <Delta now={ytdNow} before={ytdBefore} label="" /> : '—'}</td></tr>
                </tfoot>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function CompanyTable({ data, filter }: { data: ContactData; filter: Filter }) {
  const table = companyChannelTable(data.rows, data.month, filter);
  const channels = shownChannels(filter);
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>แยกบริษัท × ช่องทาง · {monthLabel(data.month)}</h2>
        <small>ตัวเล็ก = เดือนก่อนทั้งเดือน</small>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>บริษัท</th>{channels.map(c => <th key={c}>{CHANNEL_INFO[c].label}</th>)}<th>รวม</th></tr></thead>
          <tbody>
            {table.map(row => {
              const cells = row.cells.filter(c => channels.includes(c.channel));
              return (
                <tr key={row.company}>
                  <td>{COMPANY_LABEL[row.company]}</td>
                  {cells.map(c => <td key={c.channel}>{count(c.now)}<small>{count(c.before)}</small></td>)}
                  <td><b>{count(sum(cells.map(c => c.now)))}</b><small>{count(sum(cells.map(c => c.before)))}</small></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>รวม</td>
              {channels.map(c => <td key={c}>{count(sum(table.map(r => r.cells.find(x => x.channel === c)?.now ?? 0)))}</td>)}
              <td>{count(sum(table.map(r => sum(r.cells.filter(c => channels.includes(c.channel)).map(c => c.now)))))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function AccountTable({ data, filter }: { data: ContactData; filter: Filter }) {
  const lines = accountLines(data.rows, data.month, filter);
  // Group accounts by company (GFS → MHL อาคาร → MHL CAR); keep the busiest-first order inside each group.
  const groups = COMPANIES.map(company => {
    const items = lines.filter(l => l.company === company);
    return { company, lines: items, contacts: sum(items.map(l => l.contacts)), newContacts: sumOrNull(items.map(l => l.newContacts)) };
  }).filter(g => g.lines.length > 0);
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>แยกบัญชี · {monthLabel(data.month)}</h2>
        <small>{lines.length} บัญชี</small>
      </div>
      {lines.length === 0 ? <p className={styles.foot}>ยังไม่มีข้อมูลเดือนนี้</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>บัญชี</th><th>ช่องทาง</th><th>การติดต่อ</th><th>{data.dataset === 'sheet' ? 'ลูกค้าใหม่ (ต่อบริษัท)' : 'ลูกค้าใหม่'}</th><th>วันที่มีคนติดต่อ</th></tr></thead>
            {groups.map(g => (
              <tbody key={g.company}>
                <tr className={own.groupRow}>
                  <td>{COMPANY_LABEL[g.company]} <small>{g.lines.length} บัญชี</small></td>
                  <td />
                  <td>{count(g.contacts)}</td>
                  <td>{count(g.newContacts)}</td>
                  <td />
                </tr>
                {g.lines.map(l => (
                  <tr key={`${l.channel}|${l.company}|${l.account}`}>
                    <td className={own.indent}>{l.account}</td>
                    <td><i className={styles.swatch} style={{ background: CHANNEL_INFO[l.channel].color }} /> {CHANNEL_INFO[l.channel].label}</td>
                    <td>{count(l.contacts)}</td>
                    <td>{data.dataset === 'sheet' ? '—' : count(l.newContacts)}</td>
                    <td>{l.days}</td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tfoot>
              <tr>
                <td>รวมทุกบริษัท</td>
                <td />
                <td>{count(sum(lines.map(l => l.contacts)))}</td>
                <td>{count(sumOrNull(lines.map(l => l.newContacts)))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function ShareCard({ data, filter }: { data: ContactData; filter: Filter }) {
  const table = companyChannelTable(data.rows, data.month, { ...filter, channel: 'all' });
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}><h2>สัดส่วนช่องทางของแต่ละบริษัท · {monthLabel(data.month)}</h2></div>
      {table.map(row => (
        <div key={row.company} className={own.shareRow}>
          <h3 className={styles.subhead}>{COMPANY_LABEL[row.company]} <small>{count(row.total)} การติดต่อ</small></h3>
          {row.total === 0 ? <p className={styles.foot}>ยังไม่มีข้อมูล</p> : (
            <>
              <div className={styles.shareBar} role="img"
                aria-label={row.cells.map(c => `${CHANNEL_INFO[c.channel].label} ${percent(c.now / row.total)}`).join(', ')}>
                {row.cells.filter(c => c.now > 0).map(c => <span key={c.channel} style={{ width: `${(c.now / row.total) * 100}%`, background: CHANNEL_INFO[c.channel].color }} />)}
              </div>
              <div className={styles.legend}>
                {row.cells.map(c => (
                  <span key={c.channel}><i className={styles.swatch} style={{ background: CHANNEL_INFO[c.channel].color }} />{CHANNEL_INFO[c.channel].label} <b>{percent(c.now / row.total)}</b> ({count(c.now)})</span>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </section>
  );
}

function WeekdayCard({ data, filter }: { data: ContactData; filter: Filter }) {
  const points = weekdayAverages(data.rows, data.month, daysInMonth(data.month), data.today, filter);
  const best = points.reduce<typeof points[number] | null>((top, p) => (p.average !== null && (!top || (top.average ?? 0) < p.average) ? p : top), null);
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>เฉลี่ยต่อวันตามวันในสัปดาห์ · {monthLabel(data.month)}</h2>
        <small>{best?.average ? `มากที่สุด: วัน${best.label} เฉลี่ย ${one(best.average)} คน` : 'ยังไม่มีข้อมูล'}</small>
      </div>
      <div className={styles.chart} role="img" aria-label="จำนวนการติดต่อเฉลี่ยตามวันในสัปดาห์">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points.map(p => ({ ...p, average: p.average ?? 0 }))} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#eef0f3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} width={36} />
            <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }}
              formatter={(value, _name, item) => [`${one(Number(value))} คน (จาก ${(item.payload as { days: number }).days} วัน)`, 'เฉลี่ย']} />
            <Bar dataKey="average" name="เฉลี่ยต่อวัน" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function AdsCard({ data, filter }: { data: ContactData; filter: Filter }) {
  const upto = completeDays(data);
  // On the 1st (no finished day yet) today so far is used, since this card compares within one period.
  const inRange = (date: string) => date.startsWith(data.month) && (upto === 0 || Number(date.slice(8)) <= upto);
  const companies = COMPANIES.filter(c => filter.company === 'all' || c === filter.company);
  const rows = companies.map(company => {
    const ads = data.ads.filter(a => a.company === company && inRange(a.date));
    const contacts = sum(data.rows.filter(r => r.company === company && inRange(r.date)).map(r => r.contacts));
    const fb = sum(data.rows.filter(r => r.company === company && r.channel === 'facebook' && inRange(r.date)).map(r => r.contacts));
    const spend = sum(ads.map(a => a.spend));
    const adChats = sum(ads.map(a => a.messages));
    return { company, contacts, fb, adChats, spend, perContact: contacts > 0 ? spend / contacts : null };
  });
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>เทียบกับโฆษณา · {monthLabel(data.month)}{data.today.startsWith(data.month) ? (upto ? ` (ถึงวันที่ ${upto})` : ' (วันนี้ถึงตอนนี้)') : ''}</h2>
        <small>ค่าโฆษณาจากหน้าข้อมูลตลาด</small>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>บริษัท</th><th>การติดต่อทุกช่องทาง</th><th>FB Chat</th><th>แชทที่เริ่มจากโฆษณา FB</th><th>ค่าโฆษณาทุกแพลตฟอร์ม</th><th>ค่าโฆษณาต่อ 1 การติดต่อ</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.company}>
                <td>{COMPANY_LABEL[r.company]}</td>
                <td>{count(r.contacts)}</td>
                <td>{count(r.fb)}</td>
                <td>{count(r.adChats)}{r.fb > 0 && <small>{percent(r.adChats / r.fb)} ของ FB Chat</small>}</td>
                <td>{baht(r.spend)}</td>
                <td>{baht(r.perContact)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.foot}>
        แชทจากโฆษณานับตามนิยามของ Meta (บทสนทนาที่เริ่มใหม่ภายใน 7 วันหลังเห็นโฆษณา) ส่วน FB Chat {data.dataset === 'sheet' ? 'คือลีด FB ที่แอดมินบันทึกในชีต' : 'นับลูกค้าไม่ซ้ำต่อวันจาก GOOD CRM'}
        จึงเป็นสัดส่วนโดยประมาณ อาจเกิน 100% ได้ · GFS รวม B2B และ B2C
      </p>
    </section>
  );
}

function Changes({ data, filter }: { data: ContactData; filter: Filter }) {
  const upto = completeDays(data);
  const prev = shiftMonth(data.month, -1);
  const firstDay = upto === 0;
  const items = firstDay ? [] : COMPANIES.filter(c => filter.company === 'all' || c === filter.company).flatMap(company => shownChannels(filter).map(channel => {
    const now = monthContacts(data.rows, data.month, { company, channel }, upto);
    const before = monthContacts(data.rows, prev, { company, channel }, upto);
    return { company, channel, now, before, diff: now - before, rate: change(now, before) };
  })).filter(i => i.now + i.before >= 10).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 6);
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>เปลี่ยนแปลงมากที่สุดเทียบเดือนก่อน</h2>
        <small>ช่วงวันเดียวกัน · เฉพาะที่มีอย่างน้อย 10 การติดต่อ</small>
      </div>
      {items.length === 0 ? <p className={styles.foot}>{firstDay ? 'วันแรกของเดือน ยังไม่มีวันที่จบสำหรับเทียบ — เลือกเดือนก่อนเพื่อดูการเปลี่ยนแปลง' : 'ข้อมูลยังไม่พอเทียบ'}</p> : (
        <ul className={styles.insightGrid}>
          {items.map(i => (
            <li key={`${i.company}|${i.channel}`} className={styles.insight} data-tone={i.diff >= 0 ? 'good' : 'warn'}>
              <span className={styles.insightLabel}><i className={styles.swatch} style={{ background: CHANNEL_INFO[i.channel].color }} />{CHANNEL_INFO[i.channel].label} · {COMPANY_LABEL[i.company]}</span>
              <span className={styles.insightValue}>{i.diff >= 0 ? '+' : ''}{count(i.diff)}</span>
              <span className={styles.insightDetail}>{count(i.before)} → {count(i.now)}{i.rate !== null ? ` (${i.rate >= 0 ? '+' : ''}${Math.round(i.rate * 100)}%)` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ParsedFile { name: string; summary?: CallLogSummary; error?: string; saved?: number }

function PhoneUpload({ data, onSaved }: { data: ContactData | null; onSaved: () => void }) {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const read = async (list: FileList | null) => {
    setMessage(null);
    const parsed = await Promise.all([...(list ?? [])].map(async (file): Promise<ParsedFile> => {
      if (file.size > 30 * 1024 * 1024) return { name: file.name, error: 'ไฟล์ใหญ่เกิน 30 MB' };
      try {
        return { name: file.name, summary: summarizeCallLog(await file.text()) };
      } catch (error) {
        return { name: file.name, error: error instanceof Error ? error.message : 'อ่านไฟล์ไม่ได้' };
      }
    }));
    setFiles(parsed);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const next = [...files];
    for (const [index, file] of next.entries()) {
      if (!file.summary || file.saved !== undefined) continue;
      const { rows, from, to, companies } = file.summary;
      const res = await fetchWorkspace('/api/contacts/phone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, from, to, companies, rows }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) next[index] = { ...file, error: body.error || 'บันทึกไม่สำเร็จ' };
      else next[index] = { ...file, saved: body.rows };
      setFiles([...next]);
    }
    setSaving(false);
    const ok = next.filter(f => f.saved !== undefined).length;
    setMessage(ok ? `บันทึกแล้ว ${ok} ไฟล์` : null);
    if (ok) onSaved();
  };

  const ready = files.filter(f => f.summary && f.saved === undefined);
  const phone = data?.sync.find(s => s.source === 'phone');
  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}><h2>อัปโหลดไฟล์ประวัติการโทร</h2><small>ไฟล์ CSV จากระบบโทรศัพท์ เช่น TEL-GFS.csv, TEL-MHL+CAR.csv</small></div>
        <label className={own.drop}>
          <HiArrowUpTray aria-hidden="true" />
          <span>เลือกไฟล์ (เลือกได้หลายไฟล์)</span>
          <input type="file" accept=".csv,text/csv" multiple onChange={e => { void read(e.target.files); e.target.value = ''; }} />
        </label>
        {files.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>ไฟล์</th><th>ช่วงวันที่</th><th>บริษัท</th><th>สายทั้งหมด</th><th>สายเข้า</th><th>ผู้โทรเข้า (ไม่ซ้ำ/วัน)</th><th>สถานะ</th></tr></thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.name}>
                    <td>{f.name}</td>
                    {f.summary ? (
                      <>
                        <td>{dayLabel(f.summary.from)} – {dayLabel(f.summary.to)} {Number(f.summary.to.slice(0, 4)) + 543}</td>
                        <td>{f.summary.companies.map(c => COMPANY_LABEL[c]).join(', ')}</td>
                        <td>{count(f.summary.calls)}</td>
                        <td>{count(f.summary.inbound)}</td>
                        <td>{count(sum(f.summary.rows.map(r => r.contacts)))}</td>
                      </>
                    ) : <td colSpan={5} />}
                    <td className={f.error ? own.bad : f.saved !== undefined ? own.good : undefined}>
                      {f.error ?? (f.saved !== undefined ? `บันทึกแล้ว ${count(f.saved)} แถว` : 'พร้อมบันทึก')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={`${styles.actions} ${own.actions}`}>
          <button type="button" className="btn btn-primary btn-sm" disabled={!ready.length || saving} onClick={() => void save()}>
            {saving ? 'กำลังบันทึก…' : ready.length ? `บันทึก ${ready.length} ไฟล์` : 'บันทึก'}
          </button>
          {message && <span className={own.good} role="status">{message}</span>}
        </div>
      </section>
      <section className={`${styles.card} ${styles.foot}`}>
        <ul>
          <li>ระบบอ่านไฟล์ในเครื่องของคุณ แล้วส่งเฉพาะจำนวนผู้โทรต่อวันต่อเบอร์ เบอร์ลูกค้าไม่ถูกส่งหรือเก็บไว้</li>
          <li>นับเฉพาะสายเข้า (คอลัมน์ Dir.) · ผู้โทรเบอร์เดียวกันหลายครั้งในวันเดียวนับ 1 · สายที่ซ่อนเบอร์นับสายละ 1</li>
          <li>บริษัทดูจากเบอร์ปลายทาง (Local Party): 099-456-5294, 094-998-1234, 097-292-9488 = MHL อาคาร · 099-456-2259, 095-953-3949 = MHL CAR · เบอร์อื่น = GFS</li>
          <li>อัปโหลดซ้ำได้: ข้อมูลโทรของบริษัทในไฟล์ ช่วงวันที่ของไฟล์ จะถูกแทนที่ด้วยไฟล์ใหม่</li>
          <li>อัปโหลดล่าสุด: {when(phone?.lastRunAt ?? null)}{phone?.lastMessage ? ` (${phone.lastMessage})` : ''} · ข้อมูลโทรถึงวันที่ {phone?.latestDate ?? '—'}</li>
        </ul>
      </section>
    </>
  );
}

function monthOptions(data: ContactData | null, selected: string, today: string): string[] {
  const current = today.slice(0, 7);
  let start = data?.firstMonth && data.firstMonth < current ? data.firstMonth : shiftMonth(current, -12);
  if (selected < start) start = selected;
  const out: string[] = [];
  for (let m = current; m >= start && out.length < 120; m = shiftMonth(m, -1)) out.push(m);
  return out;
}

export default function ContactsView({ mode }: { mode: ContactsMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const todayFallback = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const askedMonth = search.get('month');
  const month = isMonthKey(askedMonth) ? askedMonth : todayFallback.slice(0, 7);
  const askedCompany = search.get('company');
  const askedChannel = search.get('channel');
  const askedDataset = search.get('dataset');
  const company: Company | 'all' = isCompany(askedCompany) ? askedCompany : 'all';
  const channel: Channel | 'all' = isChannel(askedChannel) ? askedChannel : 'all';
  const dataset: Dataset = isDataset(askedDataset) ? askedDataset : DEFAULT_DATASET;
  const filter = useMemo<Filter>(() => ({ company, channel }), [company, channel]);

  const [data, setData] = useState<ContactData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchWorkspace(`/api/contacts?month=${month}&dataset=${dataset}`)
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(res.status === 401 ? 'กรุณาเข้าสู่ระบบใหม่' : body.error || 'โหลดข้อมูลไม่สำเร็จ');
        if (alive) setData(body as ContactData);
      })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month, dataset, reload]);

  const setParam = (key: 'month' | 'company' | 'channel' | 'dataset', value: string | null) => {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value); else params.delete(key);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const refresh = async () => {
    setSyncing(true);
    setSyncNote(null);
    // Every browser write must be JSON (src/lib/browser-request.ts), even with nothing to send.
    const res = await fetchWorkspace('/api/contacts/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const body = await res.json().catch(() => ({}));
    setSyncing(false);
    setSyncNote(res.ok ? `ดึงแล้ว ${count(body.rows)} แถว (${body.from} ถึง ${body.to})` : body.error || body.message || 'ดึงข้อมูลไม่สำเร็จ');
    setReload(n => n + 1);
  };

  const query = search.toString() ? `?${search.toString()}` : '';
  const ready = data && data.month === month && data.dataset === dataset ? data : null;
  const title = SUBNAV.find(s => s.mode === mode)?.label ?? 'ข้อมูลการติดต่อ';
  const crm = ready?.sync.find(s => s.source === 'goodcrm');
  const sheets = ready?.sync.find(s => s.source === 'sheets');
  const sheetMode = dataset === 'sheet';

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.titleIcon} aria-hidden="true">{MODE_ICON[mode]}</span>
          <div>
            <h1>{title}</h1>
            <p>{mode === 'phone' ? 'ข้อมูลการติดต่อ · 1 การติดต่อ = ลูกค้า 1 คนต่อวันต่อบัญชี' : DATASET_INFO[dataset].definition} · {company === 'all' ? 'ทุกบริษัท' : COMPANY_LABEL[company]}</p>
          </div>
        </div>
        {mode !== 'phone' && (
          <div className={styles.filters}>
            <label>
              เดือน
              <select className="form-input" value={month} onChange={e => setParam('month', e.target.value === todayFallback.slice(0, 7) ? null : e.target.value)}>
                {monthOptions(ready, month, ready?.today ?? todayFallback).map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </label>
            <div className={styles.brandGroup} role="group" aria-labelledby="dataset-filter-label">
              <span id="dataset-filter-label">ชุดข้อมูล</span>
              <div className={styles.chips}>
                {DATASETS.map(d => (
                  <button key={d} type="button" className={styles.chip} aria-pressed={dataset === d} title={DATASET_INFO[d].definition}
                    onClick={() => setParam('dataset', d === DEFAULT_DATASET ? null : d)}>
                    {DATASET_INFO[d].label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.brandGroup} role="group" aria-labelledby="company-filter-label">
              <span id="company-filter-label">บริษัท</span>
              <div className={styles.chips}>
                {(['all', ...COMPANIES] as const).map(c => (
                  <button key={c} type="button" className={styles.chip} aria-pressed={company === c} onClick={() => setParam('company', c === 'all' ? null : c)}>
                    {c === 'all' ? 'ทุกบริษัท' : COMPANY_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.brandGroup} role="group" aria-labelledby="channel-filter-label">
              <span id="channel-filter-label">ช่องทาง</span>
              <div className={styles.chips}>
                {(['all', ...CHANNELS] as const).map(c => (
                  <button key={c} type="button" className={styles.chip} aria-pressed={channel === c} onClick={() => setParam('channel', c === 'all' ? null : c)}>
                    {c === 'all' ? 'ทุกช่องทาง' : CHANNEL_INFO[c].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <nav className={styles.subnav} aria-label="เมนูข้อมูลการติดต่อ">
        {SUBNAV.map(item => (
          <Link key={item.href} href={`${item.href}${query}`} aria-current={item.mode === mode ? 'page' : undefined}>{item.label}</Link>
        ))}
      </nav>

      {loading && !ready && <div className="loading-container"><div className="loading-spinner" /></div>}
      {error && <div className={styles.notice}><strong>โหลดข้อมูลไม่สำเร็จ</strong>{error}</div>}

      {mode === 'phone' ? <PhoneUpload data={data} onSaved={() => setReload(n => n + 1)} /> : ready && (
        <>
          {!ready.configured && (sheetMode ? (
            <div className={styles.notice}>
              <strong>ยังไม่ได้เชื่อมชีตแอดมิน</strong>
              ผู้ดูแลต้องตั้งค่า ADMIN_REPORT_SHEET_ID และ CAR_CRM_SHEET_ID (และ service account ของ Google) บน Vercel ก่อน ตัวเลขจากชีตจึงจะเข้ามา
            </div>
          ) : (
            <div className={styles.notice}>
              <strong>ยังไม่ได้เชื่อม GOOD CRM</strong>
              ผู้ดูแลต้องตั้งค่า GOOD_CRM_URL, GOOD_CRM_PUBLISHABLE_KEY และ GOOD_CRM_STATS_KEY บน Vercel ก่อน ตัวเลข LINE / FB / IG จึงจะเข้ามา
            </div>
          ))}
          {!sheetMode && crm?.lastOk === false && (
            <div className={styles.notice}>
              <strong>ดึงข้อมูลจาก GOOD CRM รอบล่าสุดไม่สำเร็จ ({when(crm.lastRunAt)})</strong>
              {crm.lastMessage || 'ไม่ทราบสาเหตุ'} · ตัวเลข LINE / FB / IG เป็นข้อมูลถึงวันที่ {crm.latestDate ?? '—'}
            </div>
          )}
          {sheetMode && sheets?.lastOk === false && (
            <div className={styles.notice}>
              <strong>อ่านชีตแอดมินรอบล่าสุดไม่สำเร็จ ({when(sheets.lastRunAt)})</strong>
              {sheets.lastMessage || 'ไม่ทราบสาเหตุ'} · ตัวเลขเป็นข้อมูลถึงวันที่ {sheets.latestDate ?? '—'}
            </div>
          )}

          <Tiles data={ready} filter={filter} />

          {mode === 'analysis' ? (
            <>
              <Changes data={ready} filter={filter} />
              <div className={styles.grid2}>
                <ShareCard data={ready} filter={filter} />
                <WeekdayCard data={ready} filter={filter} />
              </div>
              <AdsCard data={ready} filter={filter} />
            </>
          ) : (
            <>
              <DailyChart data={ready} filter={filter} />
              <CompanyTable data={ready} filter={filter} />
              <YearChart data={ready} filter={filter} />
              <YearCompareCard data={ready} filter={filter} />
              <AccountTable data={ready} filter={filter} />
            </>
          )}

          <section className={`${styles.card} ${styles.foot}`}>
            <div className={styles.actions}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={syncing || !ready.configured} onClick={() => void refresh()}>
                <HiArrowPath aria-hidden="true" /> {syncing ? 'กำลังดึง…' : sheetMode ? 'อ่านชีตแอดมินใหม่' : 'ดึงข้อมูลล่าสุดจาก GOOD CRM'}
              </button>
              {syncNote && <span role="status">{syncNote}</span>}
            </div>
            {sheetMode ? (
              <ul>
                <li>GFS / MHL อาคาร: ชีต คิวเชลล์_admin_report แท็บ #สถิตการติดต่อ ที่แอดมินคีย์รายวัน (โทร / LINE / FB / Walk-in / ลูกค้าใหม่) ตั้งแต่ พ.ย. 2566</li>
                <li>MHL CAR: ชีต CAR_CRM แท็บ สถิตการติดต่อ (โทร / LINE / FB / TikTok / Walk-in) ตั้งแต่ พ.ย. 2566 · ถึง 5 ต.ค. 2569 พนักงานคีย์เอง ตั้งแต่ 6 ต.ค. 2569 นับอัตโนมัติจากชีต lead · บันทึกเฉพาะวันทำงาน</li>
                <li>อ่านชีตใหม่ทั้งหมดทุกคืนหลังเที่ยงคืน (แก้ย้อนหลังในชีตแล้วเว็บตามให้) · ข้อมูลถึง {sheets?.latestDate ?? '—'} · อ่านสำเร็จล่าสุด {when(sheets?.lastOkAt ?? null)}</li>
                <li>ตัวเลขชุดนี้คือลีดที่แอดมินคัดแล้ว จึงน้อยกว่าชุด GOOD CRM ที่นับทุกคนที่ทัก ใช้เทียบกันข้ามชุดไม่ได้ · IG ไม่มีในชีต</li>
              </ul>
            ) : (
              <ul>
                <li>LINE OA / FB Chat / IG: ดึงจาก GOOD CRM ทุกคืนหลังเที่ยงคืน (ย้อน 7 วัน) · ข้อมูลถึง {crm?.latestDate ?? '—'} · ดึงสำเร็จล่าสุด {when(crm?.lastOkAt ?? null)}</li>
                <li>โทร: จากไฟล์ประวัติการโทรที่อัปโหลด · ข้อมูลถึง {ready.sync.find(s => s.source === 'phone')?.latestDate ?? '—'} · <Link href={`/contacts/phone${query}`}>อัปโหลดไฟล์</Link></li>
                <li>บัญชี: LINE @3mfilm, @goodfilm = GFS · @mhl1 = MHL อาคาร · @maholan = MHL CAR · FB และ IG ตามเพจของแต่ละบริษัท · TikTok และ Walk-in มีเฉพาะชุดชีตแอดมิน</li>
                <li>LINE @maholan ตั้งแต่ 2 ต.ค. 2569 อ่านจากชีต CAR_Line_Daily (GOOD CRM ไม่ได้รับ @maholan ตั้งแต่ 4 ต.ค.) นับลูกค้าไม่ซ้ำต่อวันเหมือนกัน แต่ไม่แยกลูกค้าใหม่</li>
                <li>ลูกค้าคนเดียวทักหลายช่องทาง นับแยกตามบัญชี · GOOD CRM เริ่มเก็บตั้งแต่ ก.ย. 2569 ข้อมูลก่อนหน้านั้นดูได้ที่ชุด ชีตแอดมิน</li>
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
