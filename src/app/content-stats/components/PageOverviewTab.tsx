'use client';

import { useState, useEffect } from 'react';
import { HiPlus, HiTrash, HiXMark } from 'react-icons/hi2';
import { useAuth } from '@/contexts/AuthContext';

export default function PageOverviewTab() {
  const { currentUserId } = useAuth();
  const [monthFilter, setMonthFilter] = useState((new Date().getMonth() + 1).toString());
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  const [channels, setChannels] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isManaging, setIsManaging] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelPlatform, setNewChannelPlatform] = useState('Facebook');

  useEffect(() => {
    fetchChannels();
    fetch('/api/members')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMembers(data.filter(m => m.status !== 'inactive'));
      });
  }, []);

  useEffect(() => {
    if (channels.length > 0) {
      fetchMetrics();
    }
  }, [channels, monthFilter, yearFilter]);

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      if (data.channels) setChannels(data.channels);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/channel-metrics?month=${monthFilter}&year=${yearFilter}`);
      const data = await res.json();
      if (data.metrics) {
        const metricMap: Record<string, any> = {};
        data.metrics.forEach((m: any) => {
          metricMap[m.channelId] = m;
        });
        setMetrics(metricMap);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleAddChannel = async (e: any) => {
    e.preventDefault();
    if (!newChannelName) return;
    try {
      await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newChannelName, platform: newChannelPlatform })
      });
      setNewChannelName('');
      fetchChannels();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!confirm('ยืนยันการลบช่องนี้? ข้อมูลสถิติของช่องนี้ทั้งหมดจะหายไป')) return;
    try {
      await fetch(`/api/channels?id=${id}`, { method: 'DELETE' });
      fetchChannels();
    } catch (e) {
      console.error(e);
    }
  };

  const handleChange = (channelId: string, field: string, value: string) => {
    setMetrics(prev => ({
      ...prev,
      [channelId]: {
        ...(prev[channelId] || {}),
        [field]: value
      }
    }));
  };

  const handleSave = async (channelId: string) => {
    const data = metrics[channelId] || {};
    // If no recordedById is set yet, default to current user
    const recordedById = data.recordedById || currentUserId;
    // If no recordedDate is set yet, default to today
    const recordedDate = data.recordedDate || new Date().toISOString().split('T')[0];

    try {
      const res = await fetch('/api/channel-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          month: monthFilter,
          year: yearFilter,
          followers: data.followers,
          reach: data.reach,
          messages: data.messages,
          adSpend: data.adSpend,
          recordedById,
          recordedDate
        })
      });
      if (res.ok) {
        alert('บันทึกสำเร็จ');
        // Update local state so it shows the new values without reloading
        setMetrics(prev => ({
          ...prev,
          [channelId]: {
            ...prev[channelId],
            recordedById,
            recordedDate
          }
        }));
      }
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาด');
    }
  };

  if (isManaging) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>ตั้งค่า เพจ/ช่อง</h3>
          <button className="btn btn-secondary" onClick={() => setIsManaging(false)}><HiXMark /> ปิด</button>
        </div>
        
        <form onSubmit={handleAddChannel} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          <input type="text" className="form-input" placeholder="ชื่อเพจ / ช่อง (เช่น GFS Main)" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} required />
          <select className="form-input" style={{ width: '150px' }} value={newChannelPlatform} onChange={e => setNewChannelPlatform(e.target.value)}>
            <option value="Facebook">Facebook</option>
            <option value="Instagram">Instagram</option>
            <option value="TikTok">TikTok</option>
            <option value="YouTube">YouTube</option>
            <option value="Website">Website</option>
            <option value="LINE">LINE</option>
          </select>
          <button type="submit" className="btn btn-primary"><HiPlus /> เพิ่มช่อง</button>
        </form>

        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>แพลตฟอร์ม</th>
              <th style={{ textAlign: 'left' }}>ชื่อเพจ / ช่อง</th>
              <th style={{ textAlign: 'center', width: '100px' }}>ลบ</th>
            </tr>
          </thead>
          <tbody>
            {channels.map(ch => (
              <tr key={ch.id}>
                <td>{ch.platform}</td>
                <td style={{ fontWeight: 600 }}>{ch.name}</td>
                <td style={{ textAlign: 'center' }}>
                  <button style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleDeleteChannel(ch.id)}><HiTrash size={18} /></button>
                </td>
              </tr>
            ))}
            {channels.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1rem' }}>ยังไม่ได้เพิ่มช่อง</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>ภาพรวมเพจ (รายเดือน)</h3>
        
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

        <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setIsManaging(true)}>
          ตั้งค่าชื่อเพจ/ช่อง
        </button>
      </div>

      {loading ? (
        <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '1000px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>แพลตฟอร์ม</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>ชื่อเพจ / ช่อง</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>ผู้ติดตามสะสม</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>Reach รวม</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>จำนวนแชท/Inbox</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>ผู้ดูแล</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>วันที่เก็บข้อมูล</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {channels.map(ch => {
                const data = metrics[ch.id] || {};
                
                // Format date for the input
                const dateVal = data.recordedDate ? new Date(data.recordedDate).toISOString().split('T')[0] : '';

                return (
                  <tr key={ch.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#64748b', fontSize: '0.85rem' }}>{ch.platform}</td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{ch.name}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <input type="number" className="form-input" style={{ width: '80px', margin: '0 auto', textAlign: 'center', padding: '0.2rem' }} value={data.followers ?? ''} onChange={e => handleChange(ch.id, 'followers', e.target.value)} placeholder="0" />
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <input type="number" className="form-input" style={{ width: '80px', margin: '0 auto', textAlign: 'center', padding: '0.2rem' }} value={data.reach ?? ''} onChange={e => handleChange(ch.id, 'reach', e.target.value)} placeholder="0" />
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <input type="number" className="form-input" style={{ width: '80px', margin: '0 auto', textAlign: 'center', padding: '0.2rem' }} value={data.messages ?? ''} onChange={e => handleChange(ch.id, 'messages', e.target.value)} placeholder="0" />
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <select 
                        className="form-input" 
                        style={{ width: '120px', padding: '0.2rem', fontSize: '0.8rem', margin: '0 auto' }} 
                        value={data.recordedById || ''} 
                        onChange={e => handleChange(ch.id, 'recordedById', e.target.value)}
                      >
                        <option value="">-- เลือกผู้ดูแล --</option>
                        {members.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <input 
                        type="date" 
                        className="form-input" 
                        style={{ width: '110px', padding: '0.2rem', fontSize: '0.8rem', margin: '0 auto' }} 
                        value={dateVal} 
                        onChange={e => handleChange(ch.id, 'recordedDate', e.target.value)} 
                      />
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <button className="btn btn-primary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleSave(ch.id)}>บันทึก</button>
                    </td>
                  </tr>
                );
              })}
              {channels.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    ยังไม่มีข้อมูลช่อง กรุณากด "ตั้งค่าชื่อเพจ/ช่อง" ด้านขวาบน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
