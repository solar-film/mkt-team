'use client';

import { useState, type KeyboardEvent } from 'react';
import styles from './company.module.css';
import {
  BUSINESSES, CHANNEL_ROWS, COMPANIES, LOGOS, OPENING_HOURS, PEOPLE, SHARED_ROLES, STRUCTURE_AS_OF,
  type Business, type BusinessKey, type LogoKey,
} from '@/lib/company-structure';

const TABS = [
  { id: 'tree', label: 'ผังบริษัท' },
  { id: 'channels', label: 'ช่องทาง & เว็บ' },
  { id: 'people', label: 'ใครดูแล' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const BY_KEY = Object.fromEntries(BUSINESSES.map(b => [b.key, b])) as Record<BusinessKey, Business>;

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

function BusinessDetail({ business }: { business: Business }) {
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
        <div className={styles.sec}><h4>คนดูแล</h4><List items={business.people} /></div>
      </div>
    </>
  );
}

export default function CompanyStructurePage() {
  const [tab, setTab] = useState<TabId>('tree');
  const [selected, setSelected] = useState<BusinessKey>('b2c');

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
                  <small style={{ color: company.color, fontWeight: 600 }}>{company.businesses.length} ธุรกิจ</small>
                </div>
                <div className={styles.v} />
                <div className={styles.biz}>
                  {company.businesses.map(key => {
                    const business = BY_KEY[key];
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
                          <span><span className={styles.statLabel}>ดูแล</span><strong>{business.owner}</strong></span>
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
          <BusinessDetail business={BY_KEY[selected]} />
        </article>
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
              <tr>
                <th scope="row">เวลาทำการ</th>
                <td colSpan={BUSINESSES.length}>{OPENING_HOURS}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={styles.hint}>ตัวเลข “ช่องทาง” บนผัง = โทรศัพท์ + LINE OA + อีเมล ที่พี่ออยยืนยันแล้ว (ยังไม่นับโซเชียล เพราะยังไม่มีลิงก์ครบ)</div>
      </div>

      <div role="tabpanel" id="company-panel-people" aria-labelledby="company-tab-people" hidden={tab !== 'people'} className={styles.panel}>
        <div className={styles.people}>
          {PEOPLE.map(person => (
            <div key={person.name} className={styles.person}>
              <div className={styles.ph}>
                <div className={styles.av} style={{ background: person.color }} aria-hidden="true">{person.initial}</div>
                <div><b>{person.name}</b><small className={styles.muted}>{person.role}</small></div>
              </div>
              {person.duty}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
