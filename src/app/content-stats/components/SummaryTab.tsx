'use client';

import { useState, useEffect } from 'react';
import { HiChartBar, HiStar } from 'react-icons/hi2';
import { getCompanyColor } from '@/lib/colors';

export default function SummaryTab() {
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [topContents, setTopContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [monthFilter, setMonthFilter] = useState((new Date().getMonth() + 1).toString());
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchSummary();
  }, [monthFilter, yearFilter]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      // In a real app, this would be a specific summary API.
      // We will fetch contents and aggregate on the client for now.
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
        setSummaryData(summaryArr.sort((a, b) => b.views - a.views));

        // 2. Top 10 Contents
        const sortedContents = [...filtered].sort((a: any, b: any) => {
          const mA = a.metrics?.find((mx: any) => mx.snapshot === 'D+7') || a.metrics?.[0] || {};
          const mB = b.metrics?.find((mx: any) => mx.snapshot === 'D+7') || b.metrics?.[0] || {};
          return (mB.views || 0) - (mA.views || 0);
        }).slice(0, 10);
        
        setTopContents(sortedContents);
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
          
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HiChartBar /> สรุปผลงานรายบุคคล
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>พนักงาน</th>
                    <th>จำนวนชิ้นงาน</th>
                    <th>ยอดวิวรวม</th>
                    <th>ยอดวิวเฉลี่ย/ชิ้น</th>
                    <th>Reach รวม</th>
                    <th>Engagement รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.map(stat => (
                    <tr key={stat.id}>
                      <td style={{ fontWeight: 600 }}>{stat.name}</td>
                      <td>{stat.count}</td>
                      <td>{stat.views.toLocaleString()}</td>
                      <td>{stat.avgViews.toLocaleString()}</td>
                      <td>{stat.reach.toLocaleString()}</td>
                      <td>{stat.engagement.toLocaleString()}</td>
                    </tr>
                  ))}
                  {summaryData.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>ไม่มีข้อมูลในเดือนนี้</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HiStar color="#f59e0b" /> 10 อันดับคอนเทนต์ยอดวิวสูงสุด
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>อันดับ</th>
                    <th>คอนเทนต์</th>
                    <th>ผู้รับผิดชอบ</th>
                    <th>Views</th>
                    <th>Reach</th>
                    <th>Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {topContents.map((content, idx) => {
                    const metric = content.metrics?.find((mx: any) => mx.snapshot === 'D+7') || content.metrics?.[0] || {};
                    return (
                      <tr key={content.id}>
                        <td style={{ fontWeight: 700, color: idx < 3 ? '#f59e0b' : '#64748b' }}>#{idx + 1}</td>
                        <td style={{ maxWidth: '300px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <span style={{ color: getCompanyColor(content.company), marginRight: '4px' }}>[{content.company}]</span>
                            {content.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{content.platform} • {new Date(content.publishDate).toLocaleDateString('th-TH')}</div>
                        </td>
                        <td>{content.member?.name}</td>
                        <td style={{ fontWeight: 600, color: '#3b82f6' }}>{(metric.views || 0).toLocaleString()}</td>
                        <td>{(metric.reach || 0).toLocaleString()}</td>
                        <td>{((metric.likes || 0) + (metric.comments || 0) + (metric.shares || 0) + (metric.saves || 0)).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {topContents.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>ไม่มีข้อมูลในเดือนนี้</td>
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
