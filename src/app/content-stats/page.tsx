'use client';

import { useState } from 'react';
import { HiChartPie, HiPencilSquare } from 'react-icons/hi2';

// We can put sub-components here for the tabs
import RecordStatsTab from './components/RecordStatsTab';
import SummaryTab from './components/SummaryTab';
import PageOverviewTab from './components/PageOverviewTab';

export default function ContentStatsPage() {
  const [activeTab, setActiveTab] = useState('page_overview'); // 'page_overview', 'record', 'summary'

  return (
    <div style={{ padding: '0 0.5rem' }}>
      <div style={{ marginBottom: '1.5rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
          <HiChartPie /> สถิติคอนเทนต์
        </h1>
      </div>

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <button 
          onClick={() => setActiveTab('page_overview')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'page_overview' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'page_overview' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'page_overview' ? 700 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
        >
          <HiChartPie /> ภาพรวมเพจ
        </button>
        <button 
          onClick={() => setActiveTab('record')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'record' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'record' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'record' ? 700 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
        >
          <HiPencilSquare /> บันทึกสถิติ
        </button>
        <button 
          onClick={() => setActiveTab('summary')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'summary' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'summary' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'summary' ? 700 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
        >
          <HiChartPie /> สรุปผล
        </button>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', padding: '1.25rem', minHeight: '60vh' }}>
        {activeTab === 'page_overview' && <PageOverviewTab />}
        {activeTab === 'record' && <RecordStatsTab />}
        {activeTab === 'summary' && <SummaryTab />}
      </div>
    </div>
  );
}
