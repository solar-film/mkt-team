'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCompanyColor } from '@/lib/colors';

export default function RecordStatsTab() {
  const { currentUserId } = useAuth();
  const [contents, setContents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [memberFilter, setMemberFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [snapshotFilter, setSnapshotFilter] = useState('D+7');
  
  const [monthFilter, setMonthFilter] = useState((new Date().getMonth() + 1).toString());
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch members for filter
    fetch('/api/members')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMembers(data);
        } else {
          console.error('Failed to fetch members:', data);
          setMembers([]);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchContents();
  }, [memberFilter, companyFilter, platformFilter, monthFilter, yearFilter]);

  const fetchContents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content-metrics?memberId=${memberFilter}&company=${companyFilter}&platform=${platformFilter}&month=${monthFilter}&year=${yearFilter}`);
      const data = await res.json();
      if (data.contents) {
        setContents(data.contents);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleSave = async (contentId: string, metrics: any) => {
    setSavingId(contentId);
    try {
      const res = await fetch('/api/content-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId,
          snapshot: snapshotFilter,
          metrics,
          recordedById: currentUserId
        })
      });
      if (res.ok) {
        // Refresh or just indicate success
        alert('บันทึกสำเร็จ');
        fetchContents();
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาด');
    }
    setSavingId(null);
  };

  const isD7Due = (publishDate: string) => {
    if (!publishDate) return false;
    const pubDate = new Date(publishDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - pubDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 7;
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>พนักงาน</label>
          <select className="form-input" value={memberFilter} onChange={e => setMemberFilter(e.target.value)}>
            <option value="all">ทุกคน</option>
            {members.filter(m => m.status !== 'inactive').map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>แบรนด์</label>
          <select className="form-input" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
            <option value="all">ทุกแบรนด์</option>
            <option value="GFS">GFS</option>
            <option value="MHL">MHL</option>
            <option value="CAR">CAR</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>แพลตฟอร์ม</label>
          <select className="form-input" value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}>
            <option value="all">ทั้งหมด</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>รอบ (Snapshot)</label>
          <select className="form-input" value={snapshotFilter} onChange={e => setSnapshotFilter(e.target.value)}>
            <option value="D+7">D+7</option>
            <option value="D+15">D+15</option>
            <option value="D+30">D+30</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>เดือน</label>
            <select className="form-input" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
              <option value="all">ทุกเดือน</option>
              {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                <option key={m} value={m.toString()}>เดือน {m}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>ปี</label>
            <select className="form-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
              <option value="all">ทุกปี</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '1000px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>วันที่โพสต์</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>คอนเทนต์</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>ผู้รับผิดชอบ</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>Views</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>Reach</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>Engagement</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>Link Clicks</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>บันทึก</th>
              </tr>
            </thead>
            <tbody>
              {contents.map(content => {
                // Find existing metric for selected snapshot
                const metric = content.metrics?.find((m: any) => m.snapshot === snapshotFilter) || {};
                const dueAlert = snapshotFilter === 'D+7' && !metric.id && isD7Due(content.publishDate);
                
                return (
                  <ContentRow 
                    key={content.id} 
                    content={content} 
                    initialMetric={metric} 
                    snapshot={snapshotFilter} 
                    dueAlert={dueAlert} 
                    onSave={(data) => handleSave(content.id, data)}
                    saving={savingId === content.id}
                  />
                );
              })}
              {contents.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>ไม่พบข้อมูลคอนเทนต์</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContentRow({ content, initialMetric, snapshot, dueAlert, onSave, saving }: any) {
  const [metrics, setMetrics] = useState({
    views: initialMetric.views || '',
    reach: initialMetric.reach || '',
    likes: initialMetric.likes || '',
    comments: initialMetric.comments || '',
    shares: initialMetric.shares || '',
    saves: initialMetric.saves || '',
    linkClicks: initialMetric.linkClicks || ''
  });

  const handleChange = (field: string, value: string) => {
    setMetrics(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const dataToSave = {
      views: metrics.views ? parseInt(metrics.views.toString(), 10) : null,
      reach: metrics.reach ? parseInt(metrics.reach.toString(), 10) : null,
      likes: metrics.likes ? parseInt(metrics.likes.toString(), 10) : null,
      comments: metrics.comments ? parseInt(metrics.comments.toString(), 10) : null,
      shares: metrics.shares ? parseInt(metrics.shares.toString(), 10) : null,
      saves: metrics.saves ? parseInt(metrics.saves.toString(), 10) : null,
      linkClicks: metrics.linkClicks ? parseInt(metrics.linkClicks.toString(), 10) : null,
    };
    onSave(dataToSave);
  };

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '0.5rem', verticalAlign: 'middle' }}>
        <div style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
          {content.publishDate ? new Date(content.publishDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
        </div>
        {dueAlert && (
          <div style={{ marginTop: '2px' }}>
            <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', fontSize: '0.65rem', padding: '2px 4px', borderRadius: '4px', fontWeight: 600 }}>ครบ 7 วันรอกรอก</span>
          </div>
        )}
      </td>
      <td style={{ padding: '0.5rem', maxWidth: '250px', verticalAlign: 'middle' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ color: getCompanyColor(content.company), marginRight: '4px' }}>[{content.company}]</span>
          {content.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
          <span>{content.platform}</span>
          {content.link ? (
            <a 
              href={content.link.startsWith('http') ? content.link : `https://${content.link}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={(e) => {
                // If it fails to open in some embedded previews, we can try programmatic open
                try {
                  const url = content.link.startsWith('http') ? content.link : `https://${content.link}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                  e.preventDefault();
                } catch(err) {}
              }}
              style={{ color: '#3b82f6', textDecoration: 'underline', display: 'inline-block', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} 
              title={content.link}
            >
              🔗 เปิดโพสต์
            </a>
          ) : (
            <span style={{ color: '#cbd5e1' }} title="ไม่ได้ใส่ลิงก์ไว้ในระบบ">ไม่มีลิงก์</span>
          )}
        </div>
      </td>
      <td style={{ padding: '0.5rem', verticalAlign: 'middle', fontSize: '0.85rem' }}>{content.member?.name}</td>
      <td style={{ padding: '0.5rem', verticalAlign: 'middle', textAlign: 'center' }}>
        <input type="number" className="form-input" style={{ width: '60px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', margin: '0 auto', textAlign: 'center' }} value={metrics.views} onChange={e => handleChange('views', e.target.value)} />
      </td>
      <td style={{ padding: '0.5rem', verticalAlign: 'middle', textAlign: 'center' }}>
        <input type="number" className="form-input" style={{ width: '60px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', margin: '0 auto', textAlign: 'center' }} value={metrics.reach} onChange={e => handleChange('reach', e.target.value)} />
      </td>
      <td style={{ padding: '0.5rem', verticalAlign: 'middle', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Like</span>
            <input type="number" title="Likes" className="form-input" style={{ width: '50px', padding: '0.2rem', fontSize: '0.8rem', textAlign: 'center' }} value={metrics.likes} onChange={e => handleChange('likes', e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Comment</span>
            <input type="number" title="Comments" className="form-input" style={{ width: '50px', padding: '0.2rem', fontSize: '0.8rem', textAlign: 'center' }} value={metrics.comments} onChange={e => handleChange('comments', e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Share</span>
            <input type="number" title="Shares" className="form-input" style={{ width: '50px', padding: '0.2rem', fontSize: '0.8rem', textAlign: 'center' }} value={metrics.shares} onChange={e => handleChange('shares', e.target.value)} />
          </div>
        </div>
      </td>
      <td style={{ padding: '0.5rem', verticalAlign: 'middle', textAlign: 'center' }}>
        <input type="number" className="form-input" style={{ width: '60px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', margin: '0 auto', textAlign: 'center' }} value={metrics.linkClicks} onChange={e => handleChange('linkClicks', e.target.value)} />
      </td>
      <td style={{ padding: '0.5rem', verticalAlign: 'middle', textAlign: 'center' }}>
        <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', whiteSpace: 'nowrap', margin: '0 auto' }} onClick={handleSave} disabled={saving}>
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </td>
    </tr>
  );
}
