'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HiArrowDownTray, HiBanknotes, HiPresentationChartLine } from 'react-icons/hi2';
import { SiFacebook, SiGoogleads, SiOpenai } from 'react-icons/si';
import { fetchWorkspace } from '@/lib/workspace-fetch';
import {
  BRANDS, change, costPerResult, cpc, ctr, daysInMonth, isMonthKey, monthLabel, PLATFORM_INFO, PLATFORMS, results, shiftMonth, thaiMonthShort,
  type Brand, type KeywordKind, type MarketData, type Metrics, type Platform,
} from '@/lib/ads-data';
import { breakdown, campaignLines, compare, dailySeries, findings, keywordLines, spendByMonth, type Breakdown, type Filter } from '@/lib/market-analysis';
import styles from './market.module.css';

export type MarketMode = 'overview' | 'analysis' | Platform;

const SUBNAV: { href: string; label: string; mode: MarketMode }[] = [
  { href: '/market', label: 'ภาพรวมค่าโฆษณา', mode: 'overview' },
  { href: '/market/google', label: 'Google Ads', mode: 'google_ads' },
  { href: '/market/facebook', label: 'Facebook Ads', mode: 'facebook' },
  { href: '/market/chatgpt', label: 'ChatGPT Ads', mode: 'openai_ads' },
  { href: '/market/analysis', label: 'วิเคราะห์', mode: 'analysis' },
];

const MODE_ICON: Record<MarketMode, ReactNode> = {
  overview: <HiBanknotes />, analysis: <HiPresentationChartLine />,
  google_ads: <SiGoogleads />, facebook: <SiFacebook />, openai_ads: <SiOpenai />,
};

const SERIES_COLOR: Record<Platform, string> = {
  google_ads: 'var(--series-google)', facebook: 'var(--series-facebook)', openai_ads: 'var(--series-chatgpt)',
};

const baht = (n: number | null) => (n === null ? '—' : `฿${Math.round(n).toLocaleString('th-TH')}`);
const baht2 = (n: number | null) => (n === null ? '—' : `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const count = (n: number) => Math.round(n).toLocaleString('th-TH');
const percent = (n: number | null, digits = 2) => (n === null ? '—' : `${(n * 100).toFixed(digits)}%`);
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function Delta({ now, before, label }: { now: number | null; before: number | null; label: string }) {
  const c = change(now, before);
  if (c === null) return <span>{label}: ไม่มีข้อมูลเทียบ</span>;
  const flat = Math.abs(c) < 0.0005;
  const cls = flat ? styles.flat : c > 0 ? styles.up : styles.down;
  return <span>{label}: <span className={cls}>{flat ? '•' : c > 0 ? '▲' : '▼'} {Math.abs(c * 100).toFixed(1)}%</span></span>;
}

function Tile({ label, value, notes, goodUp = false }: { label: string; value: string; notes: ReactNode; goodUp?: boolean }) {
  return (
    <div className={`${styles.tile} ${goodUp ? styles.goodUp : ''}`}>
      <div className={styles.tileLabel}>{label}</div>
      <div className={styles.tileValue}>{value}</div>
      <div className={styles.tileNote}>{notes}</div>
    </div>
  );
}

function YearChart({ data, filter, title }: { data: MarketData; filter: Filter; title: string }) {
  const year = Number(data.month.slice(0, 4));
  const bars = spendByMonth(data, filter).map(b => ({ ...b, name: thaiMonthShort(b.monthNumber) }));
  const thisYear = `ปี ${year + 543}`;
  const lastYear = `ปี ${year + 542}`;
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>{title}</h2>
        <div className={styles.legend}>
          <span><i className={styles.swatch} style={{ background: 'var(--series-this-year)' }} />{thisYear}</span>
          <span><i className={styles.swatch} style={{ background: 'var(--series-last-year)' }} />{lastYear}</span>
        </div>
      </div>
      <div className={styles.chart} role="img" aria-label={`${title} รายเดือน ${thisYear} เทียบ ${lastYear}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} barGap={2} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#eef0f3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} fontSize={11} width={44} />
            <Tooltip formatter={(value) => baht(Number(value))} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
            <Bar dataKey="thisYear" name={thisYear} fill="var(--series-this-year)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="lastYear" name={lastYear} fill="var(--series-last-year)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className={styles.foot}>
        <summary>ดูเป็นตาราง</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>เดือน</th><th>{thisYear}</th><th>{lastYear}</th><th>เปลี่ยนแปลง</th></tr></thead>
            <tbody>
              {bars.map(b => (
                <tr key={b.monthNumber}>
                  <td>{b.name}</td><td>{baht(b.thisYear)}</td><td>{baht(b.lastYear)}</td>
                  <td>{change(b.thisYear, b.lastYear) === null ? '—' : percent(change(b.thisYear, b.lastYear), 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function DailyChart({ data, filter, platform }: { data: MarketData; filter: Filter; platform: Platform }) {
  const points = dailySeries(data, filter);
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>ค่าใช้จ่ายรายวัน · {monthLabel(data.month)}</h2>
        <small>ชี้ที่แท่งเพื่อดูผลลัพธ์ของวันนั้น</small>
      </div>
      <div className={styles.chart} role="img" aria-label={`ค่าใช้จ่ายรายวัน ${PLATFORM_INFO[platform].label} ${monthLabel(data.month)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#eef0f3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} fontSize={11} width={44} />
            <Tooltip
              cursor={{ fill: 'rgba(15,23,42,0.04)' }}
              labelFormatter={(day) => `วันที่ ${day}`}
              formatter={(value, _name, item) => [`${baht(Number(value))} · ผลลัพธ์ ${count((item.payload as { results: number }).results)}`, 'ค่าใช้จ่าย']}
            />
            <Bar dataKey="spend" name="ค่าใช้จ่าย" fill={SERIES_COLOR[platform]} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: Breakdown[] }) {
  const total = rows.reduce((sum, r) => sum + r.spend, 0);
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}><h2>{title}</h2></div>
      {rows.length === 0 ? <p className={styles.foot}>ยังไม่มีข้อมูลเดือนนี้</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>รายการ</th><th>ค่าใช้จ่าย</th><th>สัดส่วน</th><th>เดือนก่อน</th><th>ผลลัพธ์</th><th>ต้นทุน/ผลลัพธ์</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{baht(r.spend)}</td>
                  <td>{total > 0 ? percent(r.spend / total, 0) : '—'}</td>
                  <td>{baht(r.prevSpend)}</td>
                  <td>{count(results(r))}</td>
                  <td>{baht(costPerResult(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type SortKey = 'spend' | 'results' | 'cpr';

function CampaignTable({ data, filter, platform }: { data: MarketData; filter: Filter; platform?: Platform }) {
  const [sort, setSort] = useState<SortKey>('spend');
  const lines = campaignLines(data, filter);
  const sorted = [...lines].sort((a, b) => {
    if (sort === 'results') return results(b) - results(a);
    if (sort === 'cpr') return (costPerResult(a) ?? Infinity) - (costPerResult(b) ?? Infinity);
    return b.spend - a.spend;
  });
  const showMessages = !platform || platform === 'facebook';
  const SortButton = ({ id, children }: { id: SortKey; children: ReactNode }) => (
    <button type="button" className={styles.sortBtn} aria-pressed={sort === id} onClick={() => setSort(id)}>{children}{sort === id ? ' ↓' : ''}</button>
  );
  const total = lines.reduce((sum, l) => sum + l.spend, 0);
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>รายละเอียดแคมเปญ · {monthLabel(data.month)}</h2>
        <small>{lines.length} แคมเปญ · กดหัวคอลัมน์เพื่อเรียง</small>
      </div>
      {lines.length === 0 ? <p className={styles.foot}>ไม่มีแคมเปญที่ใช้จ่ายในเดือนนี้</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>แคมเปญ</th>
                <th><SortButton id="spend">ค่าใช้จ่าย</SortButton></th>
                <th>เดือนก่อน</th>
                <th>การแสดงผล</th>
                <th>คลิก</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>{platform === 'facebook' ? 'ลีด' : platform ? 'Conversions' : 'ลีด/Conv.'}</th>
                {showMessages && <th>แชท</th>}
                <th><SortButton id="results">ผลลัพธ์</SortButton></th>
                <th><SortButton id="cpr">ต้นทุน/ผลลัพธ์</SortButton></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(l => (
                <tr key={l.key}>
                  <td>{l.campaignName}<small>{!platform && `${PLATFORM_INFO[l.platform].label} · `}{l.accountName} · {l.brand}</small></td>
                  <td>{baht(l.spend)}</td>
                  <td>{l.prevSpend ? baht(l.prevSpend) : '—'}</td>
                  <td>{count(l.impressions)}</td>
                  <td>{count(l.clicks)}</td>
                  <td>{percent(ctr(l))}</td>
                  <td>{baht2(cpc(l))}</td>
                  <td>{count(l.leads)}</td>
                  {showMessages && <td>{count(l.messages)}</td>}
                  <td>{count(results(l))}</td>
                  <td>{baht(costPerResult(l))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>รวม</td><td>{baht(total)}</td><td colSpan={showMessages ? 9 : 8} /></tr></tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

const KEYWORD_TOP = 30;
type KeywordSort = 'spend' | 'conversions' | 'cpa';

function KeywordTable({ data, filter, kind }: { data: MarketData; filter: Filter; kind: KeywordKind }) {
  const [sort, setSort] = useState<KeywordSort>('spend');
  const cpa = (k: { spend: number; conversions: number }) => (k.conversions > 0 ? k.spend / k.conversions : null);
  const lines = keywordLines(data, filter, kind)
    .sort((a, b) => sort === 'conversions' ? b.conversions - a.conversions
      : sort === 'cpa' ? (cpa(a) ?? Infinity) - (cpa(b) ?? Infinity) : b.spend - a.spend)
    .slice(0, KEYWORD_TOP);
  const title = kind === 'keyword' ? 'คีย์เวิร์ดที่ตั้งไว้' : 'คำที่ลูกค้าค้นจริง (Search terms)';
  const SortButton = ({ id, children }: { id: KeywordSort; children: ReactNode }) => (
    <button type="button" className={styles.sortBtn} aria-pressed={sort === id} onClick={() => setSort(id)}>{children}{sort === id ? ' ↓' : ''}</button>
  );
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>{title} · {KEYWORD_TOP} อันดับแรก · {monthLabel(data.month)}</h2>
        <small>กดหัวคอลัมน์เพื่อเรียง</small>
      </div>
      {lines.length === 0 ? <p className={styles.foot}>ยังไม่มีข้อมูลคีย์เวิร์ดเดือนนี้ (ดึงพร้อมข้อมูล Google Ads)</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{kind === 'keyword' ? 'คีย์เวิร์ด' : 'คำค้น'}</th>
                <th><SortButton id="spend">ค่าใช้จ่าย</SortButton></th>
                <th>เดือนก่อน</th>
                <th>การแสดงผล</th>
                <th>คลิก</th>
                <th>CTR</th>
                <th>CPC</th>
                <th><SortButton id="conversions">Conversions</SortButton></th>
                <th><SortButton id="cpa">ต้นทุน/Conv.</SortButton></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((k, i) => (
                <tr key={`${k.accountId}|${k.text}|${k.matchType}`}>
                  <td>{i + 1}. {k.text}<small>{k.matchType && `${k.matchType} · `}{k.accountName} · {k.brand}</small></td>
                  <td>{baht(k.spend)}</td>
                  <td>{k.prevSpend === null ? '—' : baht(k.prevSpend)}</td>
                  <td>{count(k.impressions)}</td>
                  <td>{count(k.clicks)}</td>
                  <td>{percent(k.impressions > 0 ? k.clicks / k.impressions : null)}</td>
                  <td>{baht2(k.clicks > 0 ? k.spend / k.clicks : null)}</td>
                  <td>{k.conversions.toLocaleString('th-TH', { maximumFractionDigits: 1 })}</td>
                  <td>{baht(cpa(k))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Tiles({ data, filter }: { data: MarketData; filter: Filter }) {
  const c = compare(data, filter);
  const span = c.partialDay ? `1–${c.partialDay} ${monthLabel(data.month)}` : monthLabel(data.month);
  const vs = (pick: (m: Metrics) => number | null) => (
    <>
      <Delta now={pick(c.current)} before={pick(c.prevMonth)} label="เทียบเดือนก่อน" />
      <Delta now={pick(c.current)} before={pick(c.lastYear)} label="เทียบปีก่อน" />
    </>
  );
  return (
    <>
      <div className={styles.tiles}>
        <Tile label={`ค่าใช้จ่าย · ${span}`} value={baht(c.current.spend)} notes={vs(m => m.spend)} />
        <Tile label={`สะสมปี ${Number(data.month.slice(0, 4)) + 543}`} value={baht(c.ytd.spend)}
          notes={<><Delta now={c.ytd.spend} before={c.ytdLastYear.spend} label="เทียบช่วงเดียวกันปีก่อน" /><span>ปีก่อน {baht(c.ytdLastYear.spend)}</span></>} />
        <Tile label="ผลลัพธ์ (ลีด + แชท / Conversions)" value={count(results(c.current))} notes={vs(m => results(m))} goodUp />
        <Tile label="ต้นทุนต่อผลลัพธ์" value={baht(costPerResult(c.current))} notes={vs(costPerResult)} />
        <Tile label="คลิก · CTR" value={`${count(c.current.clicks)} · ${percent(ctr(c.current))}`} notes={vs(m => m.clicks)} goodUp />
        <Tile label="ต้นทุนต่อคลิก (CPC)" value={baht2(cpc(c.current))} notes={vs(cpc)} />
      </div>
      {c.partialDay && c.partialDay < daysInMonth(data.month) && <p className={styles.foot}>เดือนนี้ยังไม่จบ ตัวเลขเทียบใช้ช่วงวันที่ 1–{c.partialDay} ของทุกเดือนเท่ากัน</p>}
    </>
  );
}

function Analysis({ data, filter }: { data: MarketData; filter: Filter }) {
  const items = findings(data, filter);
  const perPlatform = PLATFORMS.map(platform => {
    const c = compare(data, { ...filter, platform });
    return { platform, ...c };
  }).filter(p => p.current.spend > 0 || p.prevMonth.spend > 0 || p.lastYear.spend > 0);
  const TONE = { good: 'ดี', warn: 'ควรดู', info: 'ข้อมูล' } as const;
  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}><h2>สรุปจากตัวเลข · {monthLabel(data.month)}</h2><small>คำนวณตามกฎจากตัวเลขจริง ไม่ใช่ความเห็น AI</small></div>
        {items.length === 0 ? <p className={styles.foot}>ยังไม่มีข้อมูลพอให้สรุป</p> : (
          <ul className={styles.findings}>
            {items.map((f, i) => (
              <li key={i} className={styles.finding} data-tone={f.tone}>
                <strong><span className={styles.tone}>[{TONE[f.tone]}]</span>{f.title}</strong>
                <span>{f.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.card}>
        <div className={styles.cardHead}><h2>เทียบทุกช่องทาง</h2><small>ช่วงวันเดียวกันทุกเดือน</small></div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>ช่องทาง</th><th>ค่าใช้จ่าย</th><th>เดือนก่อน</th><th>ปีก่อน</th><th>ผลลัพธ์</th><th>ต้นทุน/ผลลัพธ์</th><th>ต้นทุน/ผลลัพธ์ เดือนก่อน</th><th>CTR</th><th>CPC</th></tr>
            </thead>
            <tbody>
              {perPlatform.map(p => (
                <tr key={p.platform}>
                  <td>{PLATFORM_INFO[p.platform].label}</td>
                  <td>{baht(p.current.spend)}</td>
                  <td>{baht(p.prevMonth.spend)}</td>
                  <td>{baht(p.lastYear.spend)}</td>
                  <td>{count(results(p.current))}</td>
                  <td>{baht(costPerResult(p.current))}</td>
                  <td>{baht(costPerResult(p.prevMonth))}</td>
                  <td>{percent(ctr(p.current))}</td>
                  <td>{baht2(cpc(p.current))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <BreakdownTable title="แยกตามแบรนด์" rows={breakdown(data, filter, 'brand')} />
    </>
  );
}

function monthOptions(data: MarketData | null, selected: string, today: string): string[] {
  const current = today.slice(0, 7);
  let start = data?.firstMonth && data.firstMonth < current ? data.firstMonth : shiftMonth(current, -12);
  if (selected < start) start = selected;
  const out: string[] = [];
  for (let m = current; m >= start && out.length < 120; m = shiftMonth(m, -1)) out.push(m);
  return out;
}

const PLATFORM_HINT: Record<Platform, string> = {
  google_ads: 'ผลลัพธ์ = Conversions ตามที่ตั้งไว้ใน Google Ads',
  facebook: 'ผลลัพธ์ = ลีด (ฟอร์ม/เว็บ) + แชทที่เริ่มใหม่',
  openai_ads: 'ผลลัพธ์ = Conversions ที่ตั้งไว้ใน ChatGPT Ads',
};

export default function MarketView({ mode }: { mode: MarketMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const todayFallback = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const askedMonth = search.get('month');
  const month = isMonthKey(askedMonth) ? askedMonth : todayFallback.slice(0, 7);
  const askedBrand = search.get('brand');
  const brand: Brand | 'all' = BRANDS.includes(askedBrand as Brand) ? (askedBrand as Brand) : 'all';
  const platform = mode === 'overview' || mode === 'analysis' ? undefined : mode;
  const filter = useMemo<Filter>(() => ({ platform, brand }), [platform, brand]);

  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchWorkspace(`/api/market?month=${month}`)
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(res.status === 401 ? 'กรุณาเข้าสู่ระบบใหม่' : body.error || 'โหลดข้อมูลไม่สำเร็จ');
        if (alive) setData(body as MarketData);
      })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month]);

  const setParam = (key: 'month' | 'brand', value: string | null) => {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value); else params.delete(key);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const query = search.toString() ? `?${search.toString()}` : '';
  const ready = data && data.month === month ? data : null;
  const title = mode === 'overview' ? 'ภาพรวมค่าโฆษณา' : mode === 'analysis' ? 'วิเคราะห์โฆษณา' : PLATFORM_INFO[mode].label;
  const syncRows = ready ? ready.sync.filter(s => !platform || s.platform === platform) : [];
  const failing = syncRows.filter(s => s.lastOk === false);
  const exportFrom = `${Number(month.slice(0, 4)) - 1}-01`;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.titleIcon} aria-hidden="true">{MODE_ICON[mode]}</span>
          <div>
          <h1>{title}</h1>
          <p>ข้อมูลตลาด · ดึงจาก Windsor.ai วันละครั้ง · {brand === 'all' ? 'ทุกแบรนด์' : brand}</p>
          </div>
        </div>
        <div className={styles.filters}>
          <label>
            เดือน
            <select className="form-input" value={month} onChange={e => setParam('month', e.target.value === todayFallback.slice(0, 7) ? null : e.target.value)}>
              {monthOptions(ready, month, ready?.today ?? todayFallback).map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </label>
          <label>
            แบรนด์
            <select className="form-input" value={brand} onChange={e => setParam('brand', e.target.value === 'all' ? null : e.target.value)}>
              <option value="all">ทุกแบรนด์</option>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
        </div>
      </div>

      <nav className={styles.subnav} aria-label="เมนูข้อมูลตลาด">
        {SUBNAV.map(item => (
          <Link key={item.href} href={`${item.href}${query}`} aria-current={item.mode === mode ? 'page' : undefined}>{item.label}</Link>
        ))}
      </nav>

      {loading && !ready && <div className="loading-container"><div className="loading-spinner" /></div>}
      {error && <div className={styles.notice}><strong>โหลดข้อมูลไม่สำเร็จ</strong>{error}</div>}

      {ready && (
        <>
          {!ready.configured && (
            <div className={styles.notice}>
              <strong>ยังไม่ได้เชื่อม Windsor.ai</strong>
              ผู้ดูแลต้องตั้งค่า WINDSOR_API_KEY บน Vercel ก่อน จากนั้นไปที่หน้า Admin › ข้อมูลโฆษณา เพื่อดึงข้อมูลย้อนหลัง
            </div>
          )}
          {failing.map(s => (
            <div key={s.platform} className={styles.notice}>
              <strong>{PLATFORM_INFO[s.platform].label}: ดึงข้อมูลรอบล่าสุดไม่สำเร็จ ({when(s.lastRunAt)})</strong>
              {s.lastMessage || 'ไม่ทราบสาเหตุ'} · ตัวเลขที่เห็นเป็นข้อมูลถึงวันที่ {s.latestDate ?? '—'}
            </div>
          ))}

          <Tiles data={ready} filter={filter} />

          {mode === 'analysis' ? <Analysis data={ready} filter={filter} /> : (
            <>
              <YearChart data={ready} filter={filter} title={platform ? `ค่าใช้จ่าย ${PLATFORM_INFO[platform].label} รายเดือน` : 'ค่าใช้จ่ายโฆษณารวมรายเดือน'} />
              {platform ? (
                <>
                  <DailyChart data={ready} filter={filter} platform={platform} />
                  <CampaignTable data={ready} filter={filter} platform={platform} />
                  {platform === 'google_ads' && (
                    <>
                      <KeywordTable data={ready} filter={filter} kind="keyword" />
                      <KeywordTable data={ready} filter={filter} kind="search_term" />
                    </>
                  )}
                </>
              ) : (
                <div className={styles.grid2}>
                  <BreakdownTable title={`แยกตามช่องทาง · ${monthLabel(month)}`} rows={breakdown(ready, filter, 'platform')} />
                  <BreakdownTable title={`แยกตามแบรนด์ · ${monthLabel(month)}`} rows={breakdown(ready, filter, 'brand')} />
                </div>
              )}
            </>
          )}

          <section className={`${styles.card} ${styles.foot}`}>
            <div className={styles.actions}>
              <a className="btn btn-primary btn-sm" href={`/api/market/export?platform=${platform ?? 'all'}&from=${exportFrom}&to=${month}`} download>
                <HiArrowDownTray aria-hidden="true" /> ดาวน์โหลด CSV (รายวันรายแคมเปญ {monthLabel(exportFrom)} – {monthLabel(month)})
              </a>
            </div>
            <ul>
              {syncRows.map(s => (
                <li key={s.platform}>
                  {PLATFORM_INFO[s.platform].label}: ข้อมูลถึง {s.latestDate ?? '—'} · ดึงสำเร็จล่าสุด {when(s.lastOkAt)}
                </li>
              ))}
              <li>{platform ? PLATFORM_HINT[platform] : 'ผลลัพธ์ = ลีด + แชท (Facebook) หรือ Conversions (Google, ChatGPT)'} · ต้นทุนต่อผลลัพธ์ = ค่าใช้จ่าย ÷ ผลลัพธ์</li>
              <li>แบรนด์อ่านจากชื่อบัญชีโฆษณา (ชื่อมี CAR = MHL CAR, Maholan/MHL = MHL, Goodfilm/GFS = GFS)</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
