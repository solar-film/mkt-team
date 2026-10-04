'use client';

import { useState, useEffect } from 'react';
import { HiChartBar, HiStar } from 'react-icons/hi2';
import { getCompanyColor } from '@/lib/colors';

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
      const res = await fetch(`/api/content-metrics?month=${monthFilter}&year=${yearFilter}`);
      const data = await res.json();
      
      if (data.contents) {
        // Filter by month/year
        const filtered = data.contents.filter((c: any) => {
          if (!c.publishDate) return false;
          const d = new Date(c.publishDate);
          return d.getMonth() + 1 === parseInt(monthFilter) && d.getFullYear() === parseInt(yearFilter);
        });

        // 1. Aggregation by member
        const memberStats: Record<string, any> = {};
        filtered.forEach((c: any) => {
          const m = c.memberId;
          const mName = c.member?.name || 'Unknown';
          const metric = c.metrics?.find((mx: any) => mx.snapshot === 'D+7') || c.metrics?.[0] || {};
          
          if (!memberStats[m]) {
            memberStats[m] = { id: m, name: mName, count: 0, views: 0, reach: 0, engagement: 0 };
          }
          
          memberStats[m].count += 1;
          memberStats[m].views += (metric.views || 0);
          memberStats[m].reach += (metric.reach || 0);
          memberStats[m].engagement += ((metric.likes || 0) + (metric.comments || 0) + (metric.shares || 0) + (metric.saves || 0));
        });

        const summaryArr = Object.values(memberStats).map((s: any) => ({
          ...s,
          avgViews: s.count > 0 ? Math.round(s.views / s.count) : 0,
          avgReach: s.count > 0 ? Math.round(s.reach / s.count) : 0
        }));
        let tContents = 0, tViews = 0, tReach = 0, tEng = 0;
        summaryArr.forEach(s => {
          tContents += s.count;
          tViews += s.views;
          tReach += s.reach;
          tEng += s.engagement;
        });
        setTotals({ contents: tContents, views: tViews, reach: tReach, engagement: tEng });
        setSummaryData(summaryArr.sort((a, b) => b.views - a.views));

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
        fetch('/api/channels'),
        fetch(`/api/channel-metrics?month=${monthFilter}&year=${yearFilter}`)
      ]);
      const chData = await chRes.json();
      const cmData = await cmRes.json();

      if (chData.channels) {
        const combined = chData.channels.map((ch: any) => {
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
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>รายงานสรุปผล (D+7)</h3>
        <select className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          {Array.from({length: 12}, (_, i) => i + 1).map(m => (
            <option key={m} value={m.toString()}>เดือน {m}</option>
          ))}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
          <option value="2026">2026</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
                    {/* Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>คอนเทนต์ที่สร้าง (ชิ้น)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a' }}>{totals.contents.toLocaleString()}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>ยอดวิวรวม (Views)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#3b82f6' }}>{totals.views.toLocaleString()}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>การเข้าถึงรวม (Reach)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981' }}>{totals.reach.toLocaleString()}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>Engagement รวม</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f59e0b' }}>{totals.engagement.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fff' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HiChartBar color="#6366f1" /> สรุปผลงานรายบุคคล
              </h4>
            </div>
            <div style={{ overflowX: 'auto', padding: '0 1.25rem 1.25rem' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead style={{ backgroundColor: "#f8fafc" }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>พนักงาน</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem' }}>จำนวนชิ้นงาน</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>ยอดวิวรวม</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>ยอดวิวเฉลี่ย/ชิ้น</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>Reach รวม</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>Engagement รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.map(stat => (
                    <tr key={stat.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ fontWeight: 600, textAlign: 'left', padding: '0.75rem' }}>{stat.name}</td>
                      <td style={{ textAlign: 'center', padding: '0.75rem' }}>{stat.count}</td>
                      <td style={{ textAlign: 'right', padding: '0.75rem', fontWeight: 500 }}>{stat.views.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', padding: '0.75rem', color: '#64748b' }}>{stat.avgViews.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', padding: '0.75rem', color: '#64748b' }}>{stat.reach.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', padding: '0.75rem', color: '#64748b' }}>{stat.engagement.toLocaleString()}</td>
                    </tr>
                  ))}
                  {summaryData.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>ไม่มีข้อมูลในเดือนนี้</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

                    <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fff' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HiStar color="#f59e0b" /> 10 อันดับคอนเทนต์ยอดวิวสูงสุด
              </h4>
            </div>
            <div style={{ overflowX: 'auto', padding: '0 1.25rem 1.25rem' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead style={{ backgroundColor: "#f8fafc" }}>
                  <tr>
                    <th style={{ textAlign: 'center', padding: '0.75rem', width: '60px' }}>อันดับ</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', width: '45%' }}>คอนเทนต์</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem' }}>ผู้รับผิดชอบ</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>Views</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>Reach</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {topContents.map((content, idx) => {
                    const metric = content.metrics?.find((mx: any) => mx.snapshot === 'D+7') || content.metrics?.[0] || {};
                    return (
                      <tr key={content.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ fontWeight: 700, color: idx < 3 ? '#f59e0b' : '#64748b', textAlign: 'center', padding: '0.75rem' }}>#{idx + 1}</td>
                        <td style={{ maxWidth: '400px', padding: '0.75rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <span style={{ color: getCompanyColor(content.company), marginRight: '4px' }}>[{content.company}]</span>
                            {content.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{content.platform} • {new Date(content.publishDate).toLocaleDateString('th-TH')}</div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '0.75rem' }}>{content.member?.name}</td>
                        <td style={{ fontWeight: 600, color: '#3b82f6', textAlign: 'right', padding: '0.75rem' }}>{(metric.views || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', padding: '0.75rem', color: '#64748b' }}>{(metric.reach || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', padding: '0.75rem', color: '#64748b' }}>{((metric.likes || 0) + (metric.comments || 0) + (metric.shares || 0) + (metric.saves || 0)).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {topContents.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>ไม่มีข้อมูลในเดือนนี้</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

                    <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fff' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HiChartBar color="#10b981" /> สรุปภาพรวมเพจ
              </h4>
            </div>
            <div style={{ overflowX: 'auto', padding: '0 1.25rem 1.25rem' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead style={{ backgroundColor: "#f8fafc" }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>ชื่อเพจ / ช่อง</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem' }}>แพลตฟอร์ม</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>ผู้ติดตามสะสม</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>Reach รวม</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>จำนวนแชท/Inbox</th>
                  </tr>
                </thead>
                <tbody>
                  {channelSummary.map(ch => (
                    <tr key={ch.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ fontWeight: 600, textAlign: 'left', padding: '0.75rem' }}>{ch.name}</td>
                      <td style={{ textAlign: 'center', padding: '0.75rem', color: '#64748b' }}>{ch.platform}</td>
                      <td style={{ textAlign: 'right', padding: '0.75rem', fontWeight: 500 }}>{ch.followers.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', padding: '0.75rem', color: '#64748b' }}>{ch.reach.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', padding: '0.75rem', color: '#64748b' }}>{ch.messages.toLocaleString()}</td>
                    </tr>
                  ))}
                  {channelSummary.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>ไม่มีข้อมูลช่อง กรุณาตั้งค่าช่องในแท็บ "ภาพรวมเพจ"</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
