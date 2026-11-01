'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { toast } from 'react-hot-toast';
import {
  HiPlus,
  HiArrowPath,
  HiArrowTopRightOnSquare,
  HiPencilSquare,
  HiOutlineTrash,
  HiMagnifyingGlass,
  HiStar,
  HiMapPin,
  HiUser,
  HiCalendarDays,
  HiArrowUpTray,
} from 'react-icons/hi2';
import { fetchWorkspace } from '@/lib/workspace-fetch';
import Modal from '@/components/Modal';
import ConfirmModal from '@/components/ConfirmModal';
import styles from './integrations.module.css';

interface GbpLocation {
  id: string;
  name: string;
  businessKey: string;
  address: string;
  owner: string;
  rating: number;
  totalReviews: number;
  repliedCount: number;
  lastReviewAt: string;
  mapsUrl: string;
}

interface GbpReview {
  id: string;
  locationId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  reviewDate: string;
  replyText: string;
  repliedBy: string;
  source: string;
}

const MAX_PER_BUSINESS = 10;

const BUSINESS_BRAND: Record<
  string,
  {
    shortTitle: string;
    badgeLabel: string;
    logoSrc: string;
    logoBg: string;
    color: string;
    softBg: string;
  }
> = {
  GFS: {
    shortTitle: 'GOODFILM (GFS B2B / B2C)',
    badgeLabel: 'บริษัท กู๊ดฟิล์ม จำกัด',
    logoSrc: '/brands/goodfilm.webp',
    logoBg: '#1b437c',
    color: '#034aad',
    softBg: '#e3eeff',
  },
  MHL: {
    shortTitle: 'MHL อาคาร (มโหฬารฟิล์ม)',
    badgeLabel: 'ติดตั้งฟิล์มอาคาร',
    logoSrc: '/brands/maholan.webp',
    logoBg: '#ffffff',
    color: '#c2620a',
    softBg: '#fdf0e3',
  },
  CAR: {
    shortTitle: 'MHL CAR (ศูนย์ฟิล์มรถยนต์)',
    badgeLabel: 'ศูนย์ฟิล์มรถยนต์ บางนา-ลาซาล',
    logoSrc: '/brands/mhl-carfilm.webp',
    logoBg: '#000000',
    color: '#c8202f',
    softBg: '#fde8ea',
  },
};

const INITIAL_LOCATIONS: GbpLocation[] = [
  {
    id: 'loc-gfs',
    name: 'GOODFILM สำนักงานใหญ่ (GFS B2B/B2C)',
    businessKey: 'GFS',
    address: '914/10-11 ถ.ลาซาล แขวงบางนา เขตบางนา กรุงเทพฯ 10260',
    owner: 'แต้ว + จ๋าย',
    rating: 4.9,
    totalReviews: 48,
    repliedCount: 45,
    lastReviewAt: '2026-10-30',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=GOODFILM+ลาซาล+บางนา',
  },
  {
    id: 'loc-mhl',
    name: 'มโหฬารฟิล์ม สำนักงานใหญ่ (MHL อาคาร)',
    businessKey: 'MHL',
    address: '924 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260',
    owner: 'เพลง',
    rating: 4.8,
    totalReviews: 62,
    repliedCount: 58,
    lastReviewAt: '2026-10-31',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=มโหฬารฟิล์ม+ลาซาล',
  },
  {
    id: 'loc-car',
    name: 'MHL CARFILM ศูนย์ติดฟิล์มรถยนต์ (บางนา-ลาซาล)',
    businessKey: 'CAR',
    address: '924 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260 (MRT ศรีลาซาล)',
    owner: 'นน',
    rating: 4.9,
    totalReviews: 115,
    repliedCount: 112,
    lastReviewAt: '2026-11-01',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=MHL+CARFILM+ลาซาล',
  },
];

export default function GbpReviewsPage() {
  const [locations, setLocations] = useState<GbpLocation[]>(INITIAL_LOCATIONS);
  const [reviews, setReviews] = useState<GbpReview[]>([]);
  const [sheetConfigured, setSheetConfigured] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedLocFilter, setSelectedLocFilter] = useState<string>('ALL');
  const [replyFilter, setReplyFilter] = useState<'ALL' | 'UNREPLIED' | 'REPLIED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Single Review Modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    locationId: 'loc-car',
    reviewerName: '',
    rating: 5,
    comment: '',
    reviewDate: new Date().toISOString().slice(0, 10),
    replyText: '',
    repliedBy: '',
  });

  // Bulk Import 10 Reviews Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    locationId: 'loc-car',
    replaceExisting: true,
    rawLines: '',
  });

  // Reply Modal
  const [replyTarget, setReplyTarget] = useState<GbpReview | null>(null);
  const [replyForm, setReplyForm] = useState({ replyText: '', repliedBy: '' });

  // Delete Review Confirm Modal
  const [deleteReviewTarget, setDeleteReviewTarget] = useState<GbpReview | null>(null);

  // Location Edit Modal
  const [locEditTarget, setLocEditTarget] = useState<GbpLocation | null>(null);
  const [locForm, setLocForm] = useState({
    rating: 4.9,
    totalReviews: 0,
    repliedCount: 0,
    lastReviewAt: '',
  });

  const fetchData = async () => {
    try {
      const res = await fetchWorkspace('/api/integrations', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.locations) && data.locations.length > 0) setLocations(data.locations);
        if (Array.isArray(data.reviews)) setReviews(data.reviews);
        setSheetConfigured(Boolean(data.sheetConfigured));
      }
    } catch (error) {
      console.error('Error loading GBP reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSyncSheet = async () => {
    setSyncing(true);
    try {
      const res = await fetchWorkspace('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'sync-sheet' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`ดึงรีวิวล่าสุดสำเร็จ (${data.imported ?? 0} รายการ)`);
        fetchData();
      } else {
        toast.error(data.error || 'ยังไม่ได้ผูก Google Sheet สำหรับดึงรีวิวอัตโนมัติ');
      }
    } catch (error) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาดในการซิงก์รีวิว');
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = bulkForm.rawLines
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .slice(0, MAX_PER_BUSINESS);

    if (lines.length === 0) {
      toast.error('กรุณาวางข้อมูลรีวิวอย่างน้อย 1 บรรทัด');
      return;
    }

    // Format per line (Tab or | separated): วันที่(YYYY-MM-DD) | ชื่อผู้รีวิว | ดาว(1-5) | ข้อความรีวิว | คำตอบกลับ(ถ้ามี)
    const parsed = lines.map(line => {
      const parts = line.includes('\t') ? line.split('\t') : line.split('|');
      if (parts.length >= 4) {
        return {
          reviewDate: parts[0]?.trim() || new Date().toISOString().slice(0, 10),
          reviewerName: parts[1]?.trim() || 'ลูกค้า Google Maps',
          rating: Number(parts[2]?.trim()) || 5,
          comment: parts[3]?.trim() || '',
          replyText: parts[4]?.trim() || '',
          repliedBy: parts[5]?.trim() || '',
        };
      }
      return {
        reviewDate: new Date().toISOString().slice(0, 10),
        reviewerName: 'ลูกค้า Google Maps',
        rating: 5,
        comment: line,
        replyText: '',
        repliedBy: '',
      };
    });

    try {
      const res = await fetchWorkspace('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'bulk-import',
          locationId: bulkForm.locationId,
          replaceExisting: bulkForm.replaceExisting,
          reviews: parsed,
        }),
      });
      if (res.ok) {
        toast.success(`นำเข้า ${parsed.length} รีวิวล่าสุดเรียบร้อย`);
        setIsBulkModalOpen(false);
        setBulkForm({ ...bulkForm, rawLines: '' });
        fetchData();
      } else {
        toast.error('ไม่สามารถนำเข้าข้อมูลรีวิวได้');
      }
    } catch (error) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาดในการนำเข้ารีวิว');
    }
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWorkspace('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewForm),
      });
      if (res.ok) {
        toast.success('บันทึกรีวิวบน Google Maps เรียบร้อย');
        setIsReviewModalOpen(false);
        setReviewForm({
          locationId: 'loc-car',
          reviewerName: '',
          rating: 5,
          comment: '',
          reviewDate: new Date().toISOString().slice(0, 10),
          replyText: '',
          repliedBy: '',
        });
        fetchData();
      } else {
        toast.error('ไม่สามารถบันทึกรีวิวได้');
      }
    } catch (error) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกรีวิว');
    }
  };

  const handleSaveReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyTarget) return;
    try {
      const res = await fetchWorkspace('/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'review-reply',
          id: replyTarget.id,
          replyText: replyForm.replyText,
          repliedBy: replyForm.repliedBy,
        }),
      });
      if (res.ok) {
        toast.success('บันทึกการตอบกลับรีวิวเรียบร้อย');
        setReplyTarget(null);
        fetchData();
      }
    } catch (error) {
      console.error(error);
      toast.error('ไม่สามารถบันทึกการตอบกลับได้');
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locEditTarget) return;
    try {
      const res = await fetchWorkspace('/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'location',
          id: locEditTarget.id,
          ...locForm,
        }),
      });
      if (res.ok) {
        toast.success(`อัปเดตคะแนนของ ${locEditTarget.name} เรียบร้อย`);
        setLocEditTarget(null);
        fetchData();
      }
    } catch (error) {
      console.error(error);
      toast.error('ไม่สามารถอัปเดตสถิติได้');
    }
  };

  const handleConfirmDeleteReview = async () => {
    if (!deleteReviewTarget) return;
    try {
      const res = await fetchWorkspace(`/api/integrations?id=${deleteReviewTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('ลบรายการรีวิวเรียบร้อย');
        setDeleteReviewTarget(null);
        fetchData();
      }
    } catch (error) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาดในการลบรีวิว');
    }
  };

  const matchesReviewFilters = (r: GbpReview) => {
    const hasReply = Boolean(r.replyText?.trim());
    if (replyFilter === 'UNREPLIED' && hasReply) return false;
    if (replyFilter === 'REPLIED' && !hasReply) return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      r.reviewerName.toLowerCase().includes(q) ||
      r.comment.toLowerCase().includes(q) ||
      (r.replyText || '').toLowerCase().includes(q) ||
      (r.repliedBy || '').toLowerCase().includes(q)
    );
  };

  const visibleLocations =
    selectedLocFilter === 'ALL'
      ? locations
      : locations.filter(l => l.id === selectedLocFilter);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.eyebrow}>
            <HiStar size={14} /> Google Business Profile · แสดง {MAX_PER_BUSINESS} รีวิวล่าสุดต่อธุรกิจ
          </span>
          <h1 className={styles.pageTitle}>รีวิวบน Google Maps</h1>
          <p className={styles.pageSubtitle}>
            คะแนนรีวิวและรายการ {MAX_PER_BUSINESS} รีวิวล่าสุดแยกแต่ละธุรกิจ (GOODFILM, MHL อาคาร, MHL CAR)
          </p>
        </div>
        <div className={styles.headerActions}>
          {sheetConfigured && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={syncing}
              onClick={handleSyncSheet}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '12px', fontWeight: 600 }}
            >
              <HiArrowPath size={16} /> {syncing ? 'กำลังดึงรีวิว…' : 'ดึง 10 รีวิวล่าสุด'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsBulkModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '12px', fontWeight: 600 }}
          >
            <HiArrowUpTray size={16} /> นำเข้า 10 รีวิวล่าสุด
          </button>
          <a
            href="https://portermetrics.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '12px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            เปิด Porter <HiArrowTopRightOnSquare size={16} />
          </a>
          <button type="button" className={styles.addBtn} onClick={() => setIsReviewModalOpen(true)}>
            <HiPlus size={18} /> บันทึกรีวิวใหม่
          </button>
        </div>
      </div>

      {/* Top Score Cards Separated by Business (3 Businesses across 100% width) */}
      <div className={styles.businessGrid}>
        {locations.map(loc => {
          const brand = BUSINESS_BRAND[loc.businessKey] || BUSINESS_BRAND.GFS;
          const total = Number(loc.totalReviews || 0);
          const replied = Number(loc.repliedCount || 0);
          const unreplied = Math.max(0, total - replied);
          const replyPct = total > 0 ? Math.round((replied / total) * 100) : 100;
          const isSelected = selectedLocFilter === loc.id;
          const fullStars = Math.round(Number(loc.rating || 5));

          return (
            <article
              key={loc.id}
              className={`${styles.businessCard} ${isSelected ? styles.businessCardActive : ''}`}
              style={{ '--biz-color': brand.color } as CSSProperties}
            >
              <div className={styles.bizHeader}>
                <div className={styles.bizIdentity}>
                  <span className={styles.bizLogo} style={{ background: brand.logoBg }}>
                    <img src={brand.logoSrc} alt={brand.shortTitle} />
                  </span>
                  <div className={styles.bizTitleWrap}>
                    <span
                      className={styles.bizTag}
                      style={{ backgroundColor: brand.softBg, color: brand.color }}
                    >
                      {brand.badgeLabel}
                    </span>
                    <h2 className={styles.bizName}>{brand.shortTitle}</h2>
                  </div>
                </div>

                <div className={styles.scoreBox}>
                  <div className={styles.scoreNumber}>
                    {Number(loc.rating).toFixed(1)} <span style={{ fontSize: '1.25rem' }}>★</span>
                  </div>
                  <div className={styles.scoreStars} aria-hidden="true">
                    {'★'.repeat(Math.min(5, Math.max(0, fullStars)))}
                    {'☆'.repeat(Math.max(0, 5 - fullStars))}
                  </div>
                </div>
              </div>

              <div className={styles.metricsStrip}>
                <div className={styles.metricCell}>
                  <span className={styles.metricValue}>{total}</span>
                  <span className={styles.metricLabel}>รีวิวสะสมทั้งหมด</span>
                </div>
                <div className={styles.metricCell}>
                  <span className={styles.metricValue} style={{ color: '#059669' }}>
                    {replyPct}% <small style={{ fontSize: '0.72rem', fontWeight: 500 }}>({replied})</small>
                  </span>
                  <span className={styles.metricLabel}>อัตราตอบกลับ</span>
                </div>
                <div className={styles.metricCell}>
                  <span
                    className={styles.metricValue}
                    style={{ color: unreplied > 0 ? '#ea580c' : '#64748b' }}
                  >
                    {unreplied}
                  </span>
                  <span className={styles.metricLabel}>รอตอบกลับ</span>
                </div>
              </div>

              <div className={styles.bizMeta}>
                <div className={styles.bizMetaRow}>
                  <HiMapPin style={{ flexShrink: 0, marginTop: '2px', color: '#64748b' }} />
                  <span>{loc.address}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className={styles.bizMetaRow}>
                    <HiUser style={{ flexShrink: 0, marginTop: '2px', color: '#64748b' }} />
                    ผู้ดูแล: <strong>{loc.owner}</strong>
                  </span>
                  <span className={styles.bizMetaRow}>
                    <HiCalendarDays style={{ flexShrink: 0, marginTop: '2px', color: '#64748b' }} />
                    ล่าสุด: {loc.lastReviewAt || '-'}
                  </span>
                </div>
              </div>

              <div className={styles.bizFooter}>
                <a
                  href={loc.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.openLink}
                >
                  เปิด Google Maps <HiArrowTopRightOnSquare size={15} />
                </a>

                <div className={styles.footerRight}>
                  <button
                    type="button"
                    onClick={() => setSelectedLocFilter(isSelected ? 'ALL' : loc.id)}
                    className={`${styles.filterBizBtn} ${isSelected ? styles.filterBizBtnActive : ''}`}
                  >
                    {isSelected ? 'แสดงทุกธุรกิจ' : `ดูเฉพาะ ${loc.businessKey}`}
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => {
                      setLocEditTarget(loc);
                      setLocForm({
                        rating: loc.rating,
                        totalReviews: loc.totalReviews,
                        repliedCount: loc.repliedCount,
                        lastReviewAt: loc.lastReviewAt,
                      });
                    }}
                    title="แก้ไขคะแนนและยอดรีวิวธุรกิจนี้"
                  >
                    <HiPencilSquare size={16} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Filter Bar for 10 Latest Reviews per Business */}
      <div
        style={{
          width: '100%',
          backgroundColor: '#ffffff',
          border: '1px solid #e1ebf5',
          borderRadius: '20px',
          padding: '1.5rem',
          boxShadow: '0 4px 16px -4px rgba(15, 41, 66, 0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f2942', margin: 0 }}>
              10 รีวิวล่าสุด แยกแต่ละธุรกิจ
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#5a6f86', margin: '0.2rem 0 0' }}>
              แสดงสูงสุดธุรกิจละ {MAX_PER_BUSINESS} รีวิวล่าสุดเรียงตามวันที่รีวิวใหม่สุด
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div className={styles.filterTabs}>
              <button
                type="button"
                onClick={() => setSelectedLocFilter('ALL')}
                className={`${styles.filterTab} ${selectedLocFilter === 'ALL' ? styles.filterTabActive : ''}`}
              >
                ทุกธุรกิจ
              </button>
              {locations.map(l => {
                const count = reviews.filter(r => r.locationId === l.id).slice(0, MAX_PER_BUSINESS).length;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedLocFilter(l.id)}
                    className={`${styles.filterTab} ${selectedLocFilter === l.id ? styles.filterTabActive : ''}`}
                  >
                    {l.businessKey === 'GFS' ? 'GOODFILM' : l.businessKey === 'MHL' ? 'MHL อาคาร' : 'MHL CAR'} ({count}/{MAX_PER_BUSINESS})
                  </button>
                );
              })}
            </div>

            <div className={styles.filterTabs}>
              <button
                type="button"
                onClick={() => setReplyFilter('ALL')}
                className={`${styles.filterTab} ${replyFilter === 'ALL' ? styles.filterTabActive : ''}`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setReplyFilter('UNREPLIED')}
                className={`${styles.filterTab} ${replyFilter === 'UNREPLIED' ? styles.filterTabActive : ''}`}
              >
                รอตอบกลับ
              </button>
              <button
                type="button"
                onClick={() => setReplyFilter('REPLIED')}
                className={`${styles.filterTab} ${replyFilter === 'REPLIED' ? styles.filterTabActive : ''}`}
              >
                ตอบแล้ว
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <div className={styles.searchWrap}>
            <HiMagnifyingGlass className={styles.searchIcon} size={18} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="ค้นหาชื่อผู้รีวิว, ข้อความรีวิว, หรือผู้ตอบกลับ..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading && reviews.length === 0 ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {visibleLocations.map(loc => {
              const brand = BUSINESS_BRAND[loc.businessKey] || BUSINESS_BRAND.GFS;
              const locLatest10 = reviews
                .filter(r => r.locationId === loc.id)
                .slice(0, MAX_PER_BUSINESS)
                .filter(matchesReviewFilters);

              return (
                <section
                  key={loc.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderTop: `3px solid ${brand.color}`,
                    borderRadius: '16px',
                    padding: '1.15rem 1.25rem',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      marginBottom: '0.9rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: '#0f2942' }}>
                        {brand.shortTitle}
                      </h3>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.6rem',
                          borderRadius: '999px',
                          backgroundColor: brand.softBg,
                          color: brand.color,
                        }}
                      >
                        แสดง {locLatest10.length} / {MAX_PER_BUSINESS} รีวิวล่าสุด
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBulkForm({ locationId: loc.id, replaceExisting: true, rawLines: '' });
                        setIsBulkModalOpen(true);
                      }}
                      style={{
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f2942',
                        borderRadius: '8px',
                        padding: '0.3rem 0.7rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      + นำเข้า 10 รีวิวของ {loc.businessKey}
                    </button>
                  </div>

                  {locLatest10.length === 0 ? (
                    <div
                      style={{
                        borderRadius: '12px',
                        border: '1px dashed #cbd5e1',
                        backgroundColor: '#ffffff',
                        padding: '1.5rem 1rem',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '0.88rem',
                      }}
                    >
                      ยังไม่มีรายการรีวิวที่ดึงเข้ามาสำหรับ {brand.shortTitle}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {locLatest10.map((rev, idx) => (
                        <div
                          key={rev.id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '0.95rem 1.1rem',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: '0.75rem',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  color: '#64748b',
                                  backgroundColor: '#f1f5f9',
                                  padding: '1px 7px',
                                  borderRadius: '999px',
                                }}
                              >
                                #{idx + 1}
                              </span>
                              <span style={{ fontWeight: 700, color: '#0f2942' }}>{rev.reviewerName}</span>
                              <span style={{ color: '#d97706', fontWeight: 700, fontSize: '0.9rem' }}>
                                {'★'.repeat(rev.rating)}
                                {'☆'.repeat(Math.max(0, 5 - rev.rating))}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{rev.reviewDate}</span>
                              <button
                                type="button"
                                className={styles.iconBtn}
                                onClick={() => {
                                  setReplyTarget(rev);
                                  setReplyForm({
                                    replyText: rev.replyText || '',
                                    repliedBy: rev.repliedBy || loc.owner || '',
                                  });
                                }}
                                title="แก้ไขคำตอบกลับรีวิว"
                              >
                                <HiPencilSquare size={15} />
                              </button>
                              <button
                                type="button"
                                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                onClick={() => setDeleteReviewTarget(rev)}
                                title="ลบรีวิว"
                              >
                                <HiOutlineTrash size={15} />
                              </button>
                            </div>
                          </div>

                          <p style={{ margin: '0.5rem 0', color: '#1e293b', fontSize: '0.92rem', lineHeight: 1.5 }}>
                            {rev.comment}
                          </p>

                          {rev.replyText ? (
                            <div
                              style={{
                                marginTop: '0.45rem',
                                padding: '0.55rem 0.85rem',
                                backgroundColor: '#f0fdf4',
                                borderLeft: '3px solid #16a34a',
                                borderRadius: '8px',
                                fontSize: '0.84rem',
                                color: '#166534',
                              }}
                            >
                              <strong>ตอบกลับแล้ว {rev.repliedBy ? `(${rev.repliedBy})` : ''}:</strong> {rev.replyText}
                            </div>
                          ) : (
                            <div style={{ marginTop: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyTarget(rev);
                                  setReplyForm({ replyText: '', repliedBy: loc.owner || '' });
                                }}
                                style={{
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  color: '#034aad',
                                  borderRadius: '8px',
                                  padding: '0.28rem 0.65rem',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                + บันทึกคำตอบกลับรีวิว
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Bulk Import up to 10 Latest Reviews */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="นำเข้า 10 รีวิวล่าสุดของธุรกิจ"
        maxWidth="620px"
      >
        <form onSubmit={handleBulkImport}>
          <div className="form-group">
            <label className="form-label">เลือกธุรกิจ *</label>
            <select
              className="form-select"
              value={bulkForm.locationId}
              onChange={e => setBulkForm({ ...bulkForm, locationId: e.target.value })}
            >
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {BUSINESS_BRAND[loc.businessKey]?.shortTitle || loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              วางข้อมูลรีวิวสูงสุด 10 บรรทัด (คัดลอกจากตาราง Porter Metrics / Google Sheets ได้เลย)
            </label>
            <small style={{ display: 'block', marginBottom: '0.4rem', color: '#64748b' }}>
              รูปแบบต่อบรรทัด: <code>วันที่(YYYY-MM-DD) | ชื่อลูกค้า | ดาว(1-5) | ข้อความรีวิว | คำตอบกลับ</code>
            </small>
            <textarea
              className="form-input"
              rows={8}
              required
              placeholder={'2026-11-01 | คุณณัฐพงศ์ | 5 | ติดฟิล์มงานเนี๊ยบมากครับ | ขอบคุณมากครับ\n2026-10-30 | คุณสมศรี | 5 | ช่างให้คำแนะนำดีมาก | ขอบคุณที่ใช้บริการค่ะ'}
              value={bulkForm.rawLines}
              onChange={e => setBulkForm({ ...bulkForm, rawLines: e.target.value })}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.86rem', marginBottom: '1rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={bulkForm.replaceExisting}
              onChange={e => setBulkForm({ ...bulkForm, replaceExisting: e.target.checked })}
            />
            แทนที่ชุดรีวิวเดิมของธุรกิจนี้ด้วยชุดใหม่ล่าสุด (ไม่เกิน 10 รีวิว)
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsBulkModalOpen(false)}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              นำเข้า 10 รีวิวล่าสุด
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Single GBP Review */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="บันทึกรีวิวบน Google Maps ใหม่"
        maxWidth="540px"
      >
        <form onSubmit={handleSaveReview}>
          <div className="form-group">
            <label className="form-label">เลือกธุรกิจ *</label>
            <select
              className="form-select"
              value={reviewForm.locationId}
              onChange={e => setReviewForm({ ...reviewForm, locationId: e.target.value })}
            >
              {locations.map(loc => {
                const brand = BUSINESS_BRAND[loc.businessKey];
                return (
                  <option key={loc.id} value={loc.id}>
                    {brand?.shortTitle || loc.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">ชื่อผู้รีวิว *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="เช่น คุณสมชาย"
                value={reviewForm.reviewerName}
                onChange={e => setReviewForm({ ...reviewForm, reviewerName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">คะแนนดาว *</label>
              <select
                className="form-select"
                value={reviewForm.rating}
                onChange={e => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
              >
                {[5, 4, 3, 2, 1].map(n => (
                  <option key={n} value={n}>{n} ดาว</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">วันที่รีวิว</label>
              <input
                type="date"
                className="form-input"
                value={reviewForm.reviewDate}
                onChange={e => setReviewForm({ ...reviewForm, reviewDate: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">ข้อความรีวิวจากลูกค้า *</label>
            <textarea
              className="form-input"
              rows={3}
              required
              placeholder="คัดลอกข้อความรีวิวจาก Google Maps หรือ Porter Metrics..."
              value={reviewForm.comment}
              onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">ข้อความตอบกลับของทีม (ถ้าตอบแล้ว)</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="ข้อความที่ตอบกลับลูกค้า..."
              value={reviewForm.replyText}
              onChange={e => setReviewForm({ ...reviewForm, replyText: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">ผู้ตอบกลับ</label>
            <input
              type="text"
              className="form-input"
              placeholder="เช่น นน (NON), เพลง (PLENG), แต้ว (TAW)"
              value={reviewForm.repliedBy}
              onChange={e => setReviewForm({ ...reviewForm, repliedBy: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsReviewModalOpen(false)}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              บันทึกรีวิว
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Reply to Review */}
      <Modal
        isOpen={!!replyTarget}
        onClose={() => setReplyTarget(null)}
        title={`บันทึกการตอบกลับรีวิวของ ${replyTarget?.reviewerName || ''}`}
        maxWidth="500px"
      >
        <form onSubmit={handleSaveReply}>
          <div className="form-group">
            <label className="form-label">ข้อความตอบกลับ</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="พิมพ์ข้อความตอบกลับ (เว้นว่างหากต้องการเปลี่ยนสถานะเป็นรอตอบกลับ)"
              value={replyForm.replyText}
              onChange={e => setReplyForm({ ...replyForm, replyText: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">ผู้ตอบกลับ</label>
            <input
              type="text"
              className="form-input"
              value={replyForm.repliedBy}
              onChange={e => setReplyForm({ ...replyForm, repliedBy: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setReplyTarget(null)}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              บันทึกคำตอบ
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Business Score Summary */}
      <Modal
        isOpen={!!locEditTarget}
        onClose={() => setLocEditTarget(null)}
        title={`อัปเดตคะแนนรีวิว: ${locEditTarget ? BUSINESS_BRAND[locEditTarget.businessKey]?.shortTitle || locEditTarget.name : ''}`}
        maxWidth="460px"
      >
        <form onSubmit={handleSaveLocation}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">คะแนนดาวเฉลี่ย (เต็ม 5.0)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                className="form-input"
                value={locForm.rating}
                onChange={e => setLocForm({ ...locForm, rating: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">วันที่รีวิวล่าสุด</label>
              <input
                type="date"
                className="form-input"
                value={locForm.lastReviewAt}
                onChange={e => setLocForm({ ...locForm, lastReviewAt: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">จำนวนรีวิวสะสมทั้งหมด</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={locForm.totalReviews}
                onChange={e => setLocForm({ ...locForm, totalReviews: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">จำนวนที่ตอบกลับแล้ว</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={locForm.repliedCount}
                onChange={e => setLocForm({ ...locForm, repliedCount: Number(e.target.value) })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setLocEditTarget(null)}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              บันทึกสถิติ
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Review Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteReviewTarget}
        onClose={() => setDeleteReviewTarget(null)}
        onConfirm={handleConfirmDeleteReview}
        title="ยืนยันการลบรายการรีวิว"
        message={`ต้องการลบรีวิวของ "${deleteReviewTarget?.reviewerName || ''}" ออกจากระบบใช่หรือไม่?`}
      />
    </div>
  );
}
