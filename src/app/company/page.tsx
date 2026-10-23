'use client';

import { useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './company.module.css';
import NumbersPanel, { baht, millions2, millionsShort, percent, SourceNote, StatsError, useCompanyStats, type StatsState } from './NumbersPanels';
import { businessFigures, type CompanyStats } from '@/lib/company-stats';
import {
  BUSINESSES, CHANNEL_ROWS, COMPANIES, LOGOS, OPENING_HOURS, PEOPLE, SHARED_ROLES, STRUCTURE_AS_OF,
  type Business, type BusinessKey, type LogoKey,
} from '@/lib/company-structure';

const TABS = [
  { id: 'tree', label: 'ผังธุรกิจ' },
  { id: 'channels', label: 'ช่องทาง & เว็บ' },
  { id: 'ads', label: 'ค่าโฆษณา' },
  { id: 'sales', label: 'ยอดขาย' },
  { id: 'people', label: 'ใครดูแล' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const BY_KEY = Object.fromEntries(BUSINESSES.map(b => [b.key, b])) as Record<BusinessKey, Business>;
const CHANNEL_SHORT: Record<string, string> = { 'Facebook Ads': 'FB', 'Google Ads': 'Google' };

/** Sheet figures, or a placeholder while loading ("…") or when the sheet cannot be read ("—"). */
function figure(state: StatsState, render: (stats: CompanyStats) => ReactNode): ReactNode {
  if (state.status === 'ready') return render(state.stats);
  return state.status === 'loading' ? '…' : '—';
}

function Logo({ logo, small = false, decorative = false }: { logo: LogoKey; small?: boolean; decorative?: boolean }) {
  const { src, alt, background, width, height } = LOGOS[logo];
  return (
    <span className={`${styles.logo} ${small ? styles.logoSm : ''}`} style={{ background, borderColor: background === '#ffffff' ? 'var(--color-border)' : background }}>
      {/* Plain img: small static logos, no need for the image optimizer. */}
      <img src={src} alt={decorative ? '' : alt} width={width} height={height} />
    </span>
  );
}

function List({ items }: { items: string[] }) {
  return <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>;
}

/** Company line on the tree: summed sales target and ad budget of its businesses. */
function companyFigures(stats: CompanyStats, keys: BusinessKey[]) {
  const sales = new Set(keys.map(key => businessFigures(stats, key).sales).filter(Boolean));
  const budgets = new Set(keys.map(key => businessFigures(stats, key).budget).filter(Boolean));
  const target = [...sales].reduce((sum, row) => sum + row!.target, 0);
  const budget = [...budgets].reduce((sum, row) => sum + row!.budget, 0);
  return `เป้าขาย ${millionsShort(target)} ล้าน · งบ Ads ${millionsShort(budget)} ล้าน/ปี`;
}

function MoneySection({ business, state }: { business: Business; state: StatsState }) {
  if (state.status !== 'ready') return <div className={styles.sec}><h4>งบ Ads / เป้าขาย</h4>{state.status === 'loading' ? 'กำลังโหลด…' : 'โหลดตัวเลขไม่สำเร็จ'}</div>;
  const { stats } = state;
  const f = businessFigures(stats, business.key);
  const channels = f.spentByChannel.filter(row => row.ytd > 0).map(row => CHANNEL_SHORT[row.channel] || row.channel).join('+');
  const spent = `${baht(f.spentYtd)} บาท${channels ? ` (${channels})` : ''}`;
  return (
    <div className={styles.sec}>
      <h4>งบ Ads / เป้าขาย {stats.year + 543}</h4>
      {f.sharedGfs ? (
        <ul>
          {f.sales && <li><span className={styles.k}>ขายได้ปีนี้</span>รวมใน GFS {baht(f.sales.sold)} ({percent(f.sales.sold / f.sales.target)})</li>}
          <li><span className={styles.k}>ใช้จริงปีนี้</span>{spent}</li>
          {f.sales && <li><span className={styles.k}>เป้าขาย</span>รวมใน GFS {baht(f.sales.target)}</li>}
          {f.budget && <li><span className={styles.k}>งบ Ads</span>รวมใน GFS {baht(f.budget.budget)}/ปี</li>}
          <li><span className={styles.tagWait}>รอแบ่ง B2B / B2C</span></li>
        </ul>
      ) : (
        <ul>
          {f.sales && <li><span className={styles.k}>ขายได้ปีนี้</span>{baht(f.sales.sold)} ({percent(f.sales.sold / f.sales.target)} ของเป้า)</li>}
          <li><span className={styles.k}>ใช้จริงปีนี้</span>{spent}{f.budget ? ` · ${percent(f.spentYtd / f.budget.budget)} ของงบ` : ''}</li>
          {f.sales && <li><span className={styles.k}>เป้าขาย</span>{baht(f.sales.target)} บาท</li>}
          {f.budget && <li><span className={styles.k}>งบ Ads</span>{baht(f.budget.budget)}/ปี (≈{baht(f.budget.budget / 12)}/เดือน)</li>}
        </ul>
      )}
    </div>
  );
}

function AccountsSection({ business, state }: { business: Business; state: StatsState }) {
  return (
    <div className={styles.sec}>
      <h4>บัญชีโฆษณา</h4>
      {state.status !== 'ready' ? (state.status === 'loading' ? 'กำลังโหลด…' : 'โหลดไม่สำเร็จ') : (
        <ul>
          {businessFigures(state.stats, business.key).accounts.map(account => (
            <li key={`${account.channel}-${account.id}`}>
              {account.channel} {account.id} · {account.name}
              {account.note && <> <span className={styles.accountNote}>{account.note}</span></>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BusinessDetail({ business, state }: { business: Business; state: StatsState }) {
  return (
    <>
      <div className={styles.dhead}>
        <Logo logo={business.logo} small decorative />
        <span className={styles.dot} style={{ background: business.color }} />
        <h3 style={{ color: business.color }}>{business.name}</h3>
        <span className={styles.muted}>{business.summary}</span>
        <span className={styles.tag}>{business.company}</span>
      </div>
      <div className={styles.dgrid}>
        <div className={styles.sec}>
          <h4>ข้อมูลบริษัท</h4>
          <ul>{business.info.map(([label, value]) => <li key={label}><span className={styles.k}>{label}</span>{value}</li>)}</ul>
        </div>
        <div className={styles.sec}><h4>เว็บไซต์ · {business.websites.length}</h4><List items={business.websites} /></div>
        {business.wholesalePages && (
          <div className={styles.sec}>
            <h4>หน้าเฉพาะงานขายส่ง</h4>
            <ul>{business.wholesalePages.map(([label, value]) => <li key={label}><span className={styles.k}>{label}</span>{value}</li>)}</ul>
          </div>
        )}
        <div className={styles.sec}><h4>ช่องทางติดต่อ</h4><List items={business.channels} /></div>
        <div className={styles.sec}><h4>โซเชียล</h4><List items={business.socials} /></div>
        <AccountsSection business={business} state={state} />
        <div className={styles.sec}><h4>คนดูแล</h4><List items={business.people} /></div>
        <MoneySection business={business} state={state} />
      </div>
    </>
  );
}

/** The Google Ads agency card names the accounts it looks after, read from the sheet. */
function agencyDuty(state: StatsState, fallback: string): string {
  if (state.status !== 'ready') return fallback;
  const accounts = state.stats.accounts.filter(account => /ReadyPlanet|คุณมิ้น/.test(`${account.name} ${account.note}`));
  if (!accounts.length) return fallback;
  return `ดูแลบัญชี ${accounts.map(account => `${account.id} (${account.business.startsWith('GFS') ? 'GFS' : 'MHL'})`).join(' และ ')}`;
}

export default function CompanyStructurePage() {
  const [tab, setTab] = useState<TabId>('tree');
  const [selected, setSelected] = useState<BusinessKey>('b2c');
  const numbers = useCompanyStats();
  const { state } = numbers;

  // Arrow keys move between tabs, as expected of a tab list.
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = TABS[(TABS.findIndex(t => t.id === tab) + step + TABS.length) % TABS.length].id;
    setTab(next);
    document.getElementById(`company-tab-${next}`)?.focus();
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-content">
          <h1>โครงสร้างธุรกิจ</h1>
          <p className={styles.muted}>ภาพรวม 2 บริษัท · 4 ธุรกิจ · ข้อมูล ณ {STRUCTURE_AS_OF}</p>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="มุมมอง">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`company-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`company-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className={styles.tab}
              onClick={() => setTab(t.id)}
              onKeyDown={onTabKeyDown}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id="company-panel-tree" aria-labelledby="company-tab-tree" hidden={tab !== 'tree'} className={styles.panel}>
        {state.status === 'error' && <StatsError code={state.code} onRetry={numbers.load} />}
        <div className={styles.tree}>
          <div className={`${styles.node} ${styles.root}`}>
            <b>Good Group</b>
            <small className={styles.muted}>2 บริษัท · 4 ธุรกิจ</small>
          </div>
          <div className={styles.v} />
          <div className={styles.companies}>
            {COMPANIES.map(company => (
              <div key={company.name} className={styles.col}>
                <div className={styles.v} />
                <div className={`${styles.node} ${styles.company}`} style={{ borderColor: company.color }}>
                  <Logo logo={company.logo} />
                  <b>{company.name}</b>
                  <small className={styles.figure} style={{ color: company.color }}>
                    {state.status === 'ready' ? companyFigures(state.stats, company.businesses) : `${company.businesses.length} ธุรกิจ`}
                  </small>
                </div>
                <div className={styles.v} />
                <div className={styles.biz}>
                  {company.businesses.map(key => {
                    const business = BY_KEY[key];
                    const f = state.status === 'ready' ? businessFigures(state.stats, key) : null;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={styles.bnode}
                        style={{ background: business.soft, color: business.color }}
                        aria-pressed={selected === key}
                        aria-controls="company-detail"
                        onClick={() => setSelected(key)}
                      >
                        <Logo logo={business.logo} small decorative />
                        <span className={styles.bn}>{business.name}</span>
                        <small>{business.short}</small>
                        <span className={styles.stats}>
                          <span><span className={styles.statLabel}>เว็บ</span><strong>{business.websiteCount}</strong></span>
                          <span><span className={styles.statLabel}>ช่องทาง</span><strong>{business.channelCount}</strong></span>
                          <span className={styles.statWide}><span className={styles.statLabel}>ดูแล</span><strong>{business.owner}</strong></span>
                          <span><span className={styles.statLabel}>งบ Ads</span><strong>{figure(state, () => (f!.sharedGfs ? 'รวม GFS' : f!.budget ? `${millionsShort(f!.budget.budget)} ล.` : '—'))}</strong></span>
                          <span><span className={styles.statLabel}>เป้าขาย</span><strong>{figure(state, () => (f!.sharedGfs ? 'รวม GFS' : f!.sales ? `${millionsShort(f!.sales.target)} ล.` : '—'))}</strong></span>
                          <span className={styles.statWide}><span className={styles.statLabel}>ใช้แล้วปีนี้</span><strong>{figure(state, () => `${millions2(f!.spentYtd)} ล.`)}</strong></span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.shared}>
            {SHARED_ROLES.map(([name, role]) => (
              <span key={name} className={styles.chip}>{name} <em className={styles.muted} style={{ fontStyle: 'normal' }}>{role}</em></span>
            ))}
          </div>
        </div>

        <article id="company-detail" className={styles.detail} aria-live="polite">
          <BusinessDetail business={BY_KEY[selected]} state={state} />
        </article>
        {state.status === 'ready' && <SourceNote stats={state.stats} />}
      </div>

      <div role="tabpanel" id="company-panel-channels" aria-labelledby="company-tab-channels" hidden={tab !== 'channels'} className={styles.panel}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th />
                {BUSINESSES.map(business => (
                  <th key={business.key} style={{ color: business.color }}>
                    <Logo logo={business.logo} small />
                    <br />
                    {business.name}
                    <small className={styles.aim}>{business.aim}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CHANNEL_ROWS.map(row => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((lines, index) => (
                    <td key={BUSINESSES[index].key}>
                      {lines.map(line => <span key={line} className={styles.cellLine}>{line}</span>)}
                    </td>
                  ))}
                </tr>
              ))}
              {['Facebook Ads', 'Google Ads'].map(channel => (
                <tr key={channel}>
                  <th scope="row">{channel}</th>
                  {BUSINESSES.map(business => (
                    <td key={business.key}>
                      {figure(state, stats => {
                        const accounts = businessFigures(stats, business.key).accounts.filter(account => account.channel === channel);
                        return accounts.length ? accounts.map(account => (
                          <span key={account.id} className={styles.cellLine}>
                            {account.id}<br /><small className={styles.muted}>{account.name}</small>
                            {account.note && <><br /><span className={styles.accountNote}>{account.note}</span></>}
                          </span>
                        )) : '—';
                      })}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">เวลาทำการ</th>
                <td colSpan={BUSINESSES.length}>{OPENING_HOURS}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {(['ads', 'sales'] as const).map(view => (
        <div key={view} role="tabpanel" id={`company-panel-${view}`} aria-labelledby={`company-tab-${view}`} hidden={tab !== view} className={styles.panel}>
          {tab === view && <NumbersPanel view={view} stats={numbers} />}
        </div>
      ))}

      <div role="tabpanel" id="company-panel-people" aria-labelledby="company-tab-people" hidden={tab !== 'people'} className={styles.panel}>
        <div className={styles.people}>
          {PEOPLE.map(person => (
            <div key={person.name} className={styles.person}>
              <div className={styles.ph}>
                <div className={styles.av} style={{ background: person.color }} aria-hidden="true">{person.initial}</div>
                <div><b>{person.name}</b><small className={styles.muted}>{person.role}</small></div>
              </div>
              {person.name.startsWith('คุณมิ้น') ? agencyDuty(state, person.duty) : person.duty}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
