'use client';
import { fetchWorkspace } from '@/lib/workspace-fetch';

import { useState, useEffect, type CSSProperties } from 'react';
import { HiChartBar, HiDocumentText, HiEye, HiArrowTrendingUp, HiChatBubbleLeftRight, HiUsers, HiTrophy } from 'react-icons/hi2';
import { getCompanyColor } from '@/lib/colors';
import { memberSelectionLabel, parseSelection } from '@/lib/assignments';
import styles from './SummaryTab.module.css';

export function summarizeContentMetrics(contents: any[]) {
  const memberStats: Record<string, any> = {};
  const totals = { contents: 0, views: 0, reach: 0, engagement: 0 };
  contents.forEach(content => {
    const memberIds = parseSelection(content.memberIds?.length ? content.memberIds : content.memberId).sort();
    const key = JSON.stringify(memberIds);
    const name = memberSelectionLabel(memberIds, content.assignedMembers || (content.member ? [content.member] : []));
    const metric = content.metrics?.find((mx: any) => mx.snapshot === 'D+7') || content.metrics?.[0] || {};
    const views = metric.views || 0;
    const reach = metric.reach || 0;
    const engagement = (metric.likes || 0) + (metric.comments || 0) + (metric.shares || 0) + (metric.saves || 0);

    if (!memberStats[key]) memberStats[key] = { id: key, name, count: 0, views: 0, reach: 0, engagement: 0 };
    memberStats[key].count += 1;
    memberStats[key].views += views;
    memberStats[key].reach += reach;
    memberStats[key].engagement += engagement;
    // Shared work belongs to one owner group and contributes once to the overall totals.
    totals.contents += 1;
    totals.views += views;
    totals.reach += reach;
    totals.engagement += engagement;
  });
  const summary = Object.values(memberStats).map((stat: any) => ({
    ...stat,
    avgViews: stat.count > 0 ? Math.round(stat.views / stat.count) : 0,
    avgReach: stat.count > 0 ? Math.round(stat.reach / stat.count) : 0
  })).sort((a, b) => b.views - a.views);
  return { summary, totals };
}

export default function SummaryTab() {
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [topContents, setTopContents] = useState<any[]>([]);
  const [channelSummary, setChannelSummary] = useState<any[]>([]);
  const [totals, setTotals] = useState({ contents: 0, views: 0, reach: 0, engagement: 0 });
  const [loading, setLoading] = useState(true);

  const [monthFilter, setMonthFilter] = useState((new Date().getMonth() + 1).toString());
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchSummary();
  }, [monthFilter, yearFilter]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      // 1. Fetch content metrics
      const res = await fetchWorkspace(`/api/content-metrics?month=${monthFilter}&year=${yearFilter}`);
      const data = await res.json();
      
      if (data.contents) {
        // Filter by month/year
        const filtered = data.contents.filter((c: any) => {
          if (!c.publishDate) return false;
          const d = new Date(c.publishDate);
          return d.getMonth() + 1 === parseInt(monthFilter) && d.getFullYear() === parseInt(yearFilter);
        });

        // 1. Aggregate individual work and shared owner groups without duplicating a content.
        const { summary, totals } = summarizeContentMetrics(filtered);
        setTotals(totals);
        setSummaryData(summary);

        // 2. Top 10 Contents
        const sortedContents = [...filtered].sort((a: any, b: any) => {
          const mA = a.metrics?.find((mx: any) => mx.snapshot === 'D+7') || a.metrics?.[0] || {};
          const mB = b.metrics?.find((mx: any) => mx.snapshot === 'D+7') || b.metrics?.[0] || {};
          return (mB.views || 0) - (mA.views || 0);
        }).slice(0, 10);
        
        setTopContents(sortedContents);
      }

      // 3. Fetch channel metrics for overview summary
      const [chRes, cmRes] = await Promise.all([
        fetchWorkspace('/api/channels'),
        fetchWorkspace(`/api/channel-metrics?month=${monthFilter}&year=${yearFilter}`)
      ]);
      const chData = await chRes.json();
      const cmData = await cmRes.json();

      if (chData.channels) {
        const combined: any[] = chData.channels.map((ch: any) => {
          const m = cmData.metrics?.find((mx: any) => mx.channelId === ch.id) || {};
          return {
            ...ch,
            followers: m.followers || 0,
            reach: m.reach || 0,
            messages: m.messages || 0,
            adSpend: m.adSpend || 0
          };
        });
        // Sort by followers descending
        setChannelSummary(combined.sort((a, b) => b.followers - a.followers));
      }

    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <div className={styles.report}>
      <div className={styles.toolbar}>
        <div className={styles.reportHeading}>
          <span className={styles.eyebrow}>ภาพรวมประจำเดือน</span>
          <div className={styles.title}>
            <h3>รายงานสรุปผล</h3>
            <span className={styles.snapshotBadge}>D+7</span>
          </div>
          <p className={styles.subtitle}>ผลงานทีม คอนเทนต์ยอดนิยม และภาพรวมเพจ</p>
        </div>
        <div className={styles.filters}>
          <label className={styles.filterField}>
            <span>เดือน</span>
            <select className="form-input" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
              {['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'].map((month, index) => (
                <option key={index + 1} value={(index + 1).toString()}>{month}</option>
              ))}
            </select>
          </label>
          <label className={styles.filterField}>
            <span>ปี ค.ศ.</span>
            <select className="form-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading} role="status">
          <div className="loading-spinner" aria-hidden="true" />
          <span className={styles.loadingText}>กำลังโหลดรายงาน…</span>
        </div>
      ) : (
        <>
          <div className={styles.metrics} role="group" aria-label="ยอดรวมประจำเดือน">
            <div className={styles.metric}>
              <span className={styles.metricIcon} aria-hidden="true"><HiDocumentText /></span>
              <div><div className={styles.metricLabel}>คอนเทนต์ที่สร้าง (ชิ้น)</div><div className={styles.metricValue}>{totals.contents.toLocaleString()}</div></div>
            </div>
            <div className={`${styles.metric} ${styles.metricViews}`}>
              <span className={styles.metricIcon} aria-hidden="true"><HiEye /></span>
              <div><div className={styles.metricLabel}>ยอดวิวรวม · Views</div><div className={styles.metricValue}>{totals.views.toLocaleString()}</div></div>
            </div>
            <div className={`${styles.metric} ${styles.metricReach}`}>
              <span className={styles.metricIcon} aria-hidden="true"><HiArrowTrendingUp /></span>
              <div><div className={styles.metricLabel}>การเข้าถึงรวม · Reach</div><div className={styles.metricValue}>{totals.reach.toLocaleString()}</div></div>
            </div>
            <div className={`${styles.metric} ${styles.metricEngagement}`}>
              <span className={styles.metricIcon} aria-hidden="true"><HiChatBubbleLeftRight /></span>
              <div><div className={styles.metricLabel}>Engagement รวม</div><div className={styles.metricValue}>{totals.engagement.toLocaleString()}</div></div>
            </div>
          </div>

          <div className={styles.sections}>
            <section className={styles.section} aria-labelledby="summary-channels-title">
              <div className={styles.sectionHeader}>
                <div>
                  <h4 id="summary-channels-title" className={styles.sectionTitle}><span className={`${styles.sectionIcon} ${styles.sectionIconGreen}`} aria-hidden="true"><HiChartBar /></span>สรุปภาพรวมเพจ</h4>
                  <p className={styles.sectionDescription}>ผู้ติดตาม การเข้าถึง และแชทของแต่ละเพจ</p>
                </div>
                <span className={styles.countBadge}>{channelSummary.length} เพจ / ช่อง</span>
              </div>
              <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตารางภาพรวมเพจ เลื่อนแนวนอนได้">
                <table className={styles.table} aria-label="สรุปภาพรวมเพจ">
                  <thead><tr>
                    <th scope="col">ชื่อเพจ / ช่อง</th>
                    <th scope="col">แพลตฟอร์ม</th>
                    <th scope="col" className={styles.numeric}>ผู้ติดตามสะสม</th>
                    <th scope="col" className={styles.numeric}>Reach รวม</th>
                    <th scope="col" className={styles.numeric}>จำนวนแชท/Inbox</th>
                  </tr></thead>
                  <tbody>
                    {channelSummary.map(ch => (
                      <tr key={ch.id}>
                        <th scope="row" className={styles.channelName}>{ch.name}</th>
                        <td><span className={styles.platformBadge}>{ch.platform}</span></td>
                        <td className={`${styles.numeric} ${styles.primaryNumber}`}>{ch.followers.toLocaleString()}</td>
                        <td className={`${styles.numeric} ${styles.muted}`}>{ch.reach.toLocaleString()}</td>
                        <td className={`${styles.numeric} ${styles.muted}`}>{ch.messages.toLocaleString()}</td>
                      </tr>
                    ))}
                    {channelSummary.length === 0 && <tr><td colSpan={5}><div className={styles.emptyState}><HiDocumentText aria-hidden="true" /><span>ไม่มีข้อมูลช่อง กรุณาตั้งค่าช่องในแท็บ "ภาพรวมเพจ"</span></div></td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.section} aria-labelledby="summary-members-title">
              <div className={styles.sectionHeader}>
                <div>
                  <h4 id="summary-members-title" className={styles.sectionTitle}><span className={styles.sectionIcon} aria-hidden="true"><HiUsers /></span>สรุปผลงานตามผู้รับผิดชอบ</h4>
                  <p className={styles.sectionDescription}>งานร่วมแสดงชื่อผู้รับผิดชอบครบทุกคน และนับผลงานหนึ่งครั้งต่อกลุ่ม</p>
                </div>
                <span className={styles.countBadge}>{summaryData.length} กลุ่มผู้รับผิดชอบ</span>
              </div>
              <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตารางผลงานตามผู้รับผิดชอบ เลื่อนแนวนอนได้">
                <table className={styles.table} aria-label="สรุปผลงานตามผู้รับผิดชอบ">
                  <thead><tr>
                    <th scope="col">ผู้รับผิดชอบ</th>
                    <th scope="col" className={styles.numeric}>จำนวนชิ้นงาน</th>
                    <th scope="col" className={styles.numeric}>ยอดวิวรวม</th>
                    <th scope="col" className={styles.numeric}>ยอดวิวเฉลี่ย/ชิ้น</th>
                    <th scope="col" className={styles.numeric}>Reach รวม</th>
                    <th scope="col" className={styles.numeric}>Engagement รวม</th>
                  </tr></thead>
                  <tbody>
                    {summaryData.map(stat => (
                      <tr key={stat.id}>
                        <th scope="row"><div className={styles.person}><span className={styles.avatar} aria-hidden="true">{stat.name.slice(0, 2).toUpperCase()}</span><span className={styles.personName}>{stat.name}</span></div></th>
                        <td className={styles.numeric}><span className={styles.workCount}>{stat.count}</span></td>
                        <td className={`${styles.numeric} ${styles.primaryNumber}`}>{stat.views.toLocaleString()}</td>
                        <td className={`${styles.numeric} ${styles.muted}`}>{stat.avgViews.toLocaleString()}</td>
                        <td className={`${styles.numeric} ${styles.muted}`}>{stat.reach.toLocaleString()}</td>
                        <td className={`${styles.numeric} ${styles.muted}`}>{stat.engagement.toLocaleString()}</td>
                      </tr>
                    ))}
                    {summaryData.length === 0 && <tr><td colSpan={6}><div className={styles.emptyState}><HiDocumentText aria-hidden="true" /><span>ไม่มีข้อมูลในเดือนนี้</span></div></td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.section} aria-labelledby="summary-top-title">
              <div className={styles.sectionHeader}>
                <div>
                  <h4 id="summary-top-title" className={styles.sectionTitle}><span className={`${styles.sectionIcon} ${styles.sectionIconAmber}`} aria-hidden="true"><HiTrophy /></span>10 อันดับคอนเทนต์ยอดวิวสูงสุด</h4>
                  <p className={styles.sectionDescription}>เรียงตามยอดวิวจากมากไปน้อยในเดือนที่เลือก</p>
                </div>
                <span className={styles.countBadge}>{topContents.length} รายการ</span>
              </div>
              <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตารางอันดับคอนเทนต์ เลื่อนแนวนอนได้">
                <table className={`${styles.table} ${styles.contentTable}`} aria-label="10 อันดับคอนเทนต์ยอดวิวสูงสุด">
                  <colgroup><col style={{ width: '7%' }} /><col style={{ width: '43%' }} /><col style={{ width: '14%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} /><col style={{ width: '14%' }} /></colgroup>
                  <thead><tr>
                    <th scope="col" className={styles.rankCell}>อันดับ</th>
                    <th scope="col">คอนเทนต์</th>
                    <th scope="col">ผู้รับผิดชอบ</th>
                    <th scope="col" className={styles.numeric}>Views</th>
                    <th scope="col" className={styles.numeric}>Reach</th>
                    <th scope="col" className={styles.numeric}>Engagement</th>
                  </tr></thead>
                  <tbody>
                    {topContents.map((content, idx) => {
                      const metric = content.metrics?.find((mx: any) => mx.snapshot === 'D+7') || content.metrics?.[0] || {};
                      const rankStyle = idx === 0 ? styles.rankGold : idx === 1 ? styles.rankSilver : idx === 2 ? styles.rankBronze : '';
                      return (
                        <tr key={content.id}>
                          <td className={styles.rankCell}><span className={`${styles.rankBadge} ${rankStyle}`} aria-label={`อันดับ ${idx + 1}`}>{idx + 1}</span></td>
                          <th scope="row" className={styles.contentCell}>
                            <div className={styles.contentTitle} title={content.title}>{content.title}</div>
                            <div className={styles.contentMeta}>
                              {parseSelection(content.companies?.length ? content.companies : content.company).map(company => (
                                <span key={company} className={styles.companyBadge} style={{ '--company-color': getCompanyColor(company) } as CSSProperties}>{company}</span>
                              ))}
                              <span>{content.platform}</span><span aria-hidden="true">·</span><span>{new Date(content.publishDate).toLocaleDateString('th-TH')}</span>
                            </div>
                          </th>
                          <td className={styles.personName}>{memberSelectionLabel(content.memberIds?.length ? content.memberIds : content.memberId, content.assignedMembers || (content.member ? [content.member] : []))}</td>
                          <td className={`${styles.numeric} ${styles.primaryNumber}`}>{(metric.views || 0).toLocaleString()}</td>
                          <td className={`${styles.numeric} ${styles.muted}`}>{(metric.reach || 0).toLocaleString()}</td>
                          <td className={`${styles.numeric} ${styles.muted}`}>{((metric.likes || 0) + (metric.comments || 0) + (metric.shares || 0) + (metric.saves || 0)).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {topContents.length === 0 && <tr><td colSpan={6}><div className={styles.emptyState}><HiDocumentText aria-hidden="true" /><span>ไม่มีข้อมูลในเดือนนี้</span></div></td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
