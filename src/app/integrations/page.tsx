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
  HiCog6Tooth,
  HiCheckCircle,
  HiExclamationCircle,
  HiClipboardDocument,
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

interface GbpSyncInfo {
  mode?: 'places_api' | 'sheet_and_places';
  sheetId: string;
  sheetUrl: string;
  serviceAccountEmail: string;
  configured: boolean;
  lastSyncedAt: string | null;
  lastSyncOk: boolean | null;
  lastSyncMessage: string | null;
  scheduleText: string;
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
    badgeLabel: 'บจก.กู๊ดฟิล์ม',
    logoSrc: '/brands/goodfilm.webp',
    logoBg: '#1b437c',
    color: '#034aad',
    softBg: '#e3eeff',
  },
  MHL: {
    shortTitle: 'MHL อาคาร (มโหฬารฟิล์ม)',
    badgeLabel: 'Maholan Film Co., Ltd. · ฟิล์มอาคาร',
    logoSrc: '/brands/maholan.webp',
    logoBg: '#ffffff',
    color: '#c2620a',
    softBg: '#fdf0e3',
  },
  CAR: {
    shortTitle: 'MHL CAR (ศูนย์ฟิล์มรถยนต์)',
    badgeLabel: 'ศูนย์ติดตั้งฟิล์มรถยนต์ ครบวงจร บางนา-ลาซาล',
    logoSrc: '/brands/mhl-carfilm.webp',
    logoBg: '#000000',
    color: '#c8202f',
    softBg: '#fde8ea',
  },
};

const INITIAL_LOCATIONS: GbpLocation[] = [
  {
    id: 'loc-car',
    name: 'ศูนย์ติดตั้งฟิล์มรถยนต์ ครบวงจร บางนา-ลาซาล',
    businessKey: 'CAR',
    address: '924 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260 · โทร 095-953-3949',
    owner: 'นน',
    rating: 4.9,
    totalReviews: 681,
    repliedCount: 0,
    lastReviewAt: '',
    mapsUrl: 'https://www.google.com/maps/place/?q=place_id:ChIJh5ckOqdfHTER6ayNPK4WbEw',
  },
  {
    id: 'loc-gfs',
    name: 'บจก.กู๊ดฟิล์ม (GOODFILM)',
    businessKey: 'GFS',
    address: '914/10-11 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพมหานคร 10260',
    owner: 'แต้ว + จ๋าย',
    rating: 4.9,
    totalReviews: 110,
    repliedCount: 0,
    lastReviewAt: '',
    mapsUrl: 'https://www.google.com/maps/place/?q=place_id:ChIJEcaRmgmg4jARfKsd81AwsHw',
  },
  {
    id: 'loc-mhl',
    name: 'Maholan Film Co., Ltd. (บริษัท มโหฬารฟิล์ม จำกัด) ฟิล์มอาคาร',
    businessKey: 'MHL',
    address: '1563/125 ถ.ลาซาล แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260 · โทร 094-998-1234',
    owner: 'เพลง',
    rating: 4.9,
    totalReviews: 90,
    repliedCount: 0,
    lastReviewAt: '',
    mapsUrl: 'https://www.google.com/maps/place/?q=place_id:ChIJeU7TVHWg4jARGRU9aOYQJoQ',
  },
];

function formatThaiSyncTime(iso: string | null): string {
  if (!iso) return 'ยังไม่เคยซิงก์';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function GbpReviewsPage() {
  const [locations, setLocations] = useState<GbpLocation[]>(INITIAL_LOCATIONS);
  const [reviews, setReviews] = useState<GbpReview[]>([]);
  const [syncInfo, setSyncInfo] = useState<GbpSyncInfo | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedLocFilter, setSelectedLocFilter] = useState<string>('ALL');
  const [replyFilter, setReplyFilter] = useState<'ALL' | 'UNREPLIED' | 'REPLIED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-Sync Sheet Config Modal
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [savingSheet, setSavingSheet] = useState(false);

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
        if (data.syncInfo) {
          setSyncInfo(data.syncInfo);
          setSheetUrlInput(data.syncInfo.sheetUrl || '');
        }
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

  const handleSaveSheetAndSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSheet(true);
    try {
      const res = await fetchWorkspace('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'save-sheet', sheetUrl: sheetUrlInput }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data.message || 'บันทึก Google Sheet และดึงรีวิวเข้าฐานข้อมูลเรียบร้อย');
        setIsSheetModalOpen(false);
        fetchData();
      } else {
        toast.error(data.message || data.error || 'ไม่สามารถอ่าน Google Sheet ได้ กรุณาตรวจสอบการแชร์สิทธิ์');
        if (data.syncInfo) setSyncInfo(data.syncInfo);
      }
    } catch (error) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheet');
    } finally {
      setSavingSheet(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetchWorkspace('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'sync-sheet' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data.message || `ดึงรีวิวเข้าฐานข้อมูลสำเร็จ`);
        fetchData();
      } else {
        toast.error(data.message || data.error || 'ดึงข้อมูลไม่สำเร็จ');
        if (data.syncInfo) setSyncInfo(data.syncInfo);
      }
    } catch (error) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาดในการซิงก์รีวิว');
    } finally {
      setSyncing(false);
    }
  };

  const copyServiceEmail = async () => {
    if (!syncInfo?.serviceAccountEmail) return;
    try {
      await navigator.clipboard.writeText(syncInfo.serviceAccountEmail);
      toast.success('คัดลอกอีเมลสำหรับแชร์ Google Sheet แล้ว');
    } catch {
      toast.error('คัดลอกไม่สำเร็จ กรุณาคลุมดำเพื่อคัดลอก');
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
          locationId: replyTarget.locationId,
          reviewerName: replyTarget.reviewerName,
          rating: replyTarget.rating,
          comment: replyTarget.comment,
          reviewDate: replyTarget.reviewDate,
          source: replyTarget.source,
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
            <HiStar size={14} /> Google Maps Official API → ดึงเข้าฐานข้อมูลอัตโนมัติทุกวัน
          </span>
          <h1 className={styles.pageTitle}>รีวิวบน Google Maps</h1>
          <p className={styles.pageSubtitle}>
            ดึงคะแนนดาว ยอดรีวิวสะสมจริง และ {MAX_PER_BUSINESS} รีวิวล่าสุดของแต่ละธุรกิจเข้าฐานข้อมูลอัตโนมัติทุกเช้า 07:00 น.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={syncing}
            onClick={handleSyncNow}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '12px',
              fontWeight: 600,
            }}
          >
            <HiArrowPath size={16} /> {syncing ? 'กำลังดึงจาก Google Maps…' : 'ดึงรีวิวล่าสุดเดี๋ยวนี้'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsSheetModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '12px',
              fontWeight: 600,
            }}
          >
            <HiCog6Tooth size={16} />
            {syncInfo?.sheetId ? 'ตั้งค่าชีต Porter' : 'ผูกชีต Porter (เสริม)'}
          </button>
          <button type="button" className={styles.addBtn} onClick={() => setIsReviewModalOpen(true)}>
            <HiPlus size={18} /> บันทึกรีวิวเสริม
          </button>
        </div>
      </div>

      {/* Auto-Sync Status Strip */}
      <div
        style={{
          width: '100%',
          marginBottom: '1.5rem',
          padding: '0.85rem 1.2rem',
          borderRadius: '14px',
          border: syncInfo?.lastSyncOk === false ? '1px solid #fed7aa' : '1px solid #bbf7d0',
          backgroundColor: syncInfo?.lastSyncOk === false ? '#fff7ed' : '#f0fdf4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.86rem', color: '#0f2942' }}>
          {syncInfo?.lastSyncOk === false ? (
            <HiExclamationCircle size={20} color="#ea580c" style={{ flexShrink: 0 }} />
          ) : (
            <HiCheckCircle size={20} color="#16a34a" style={{ flexShrink: 0 }} />
          )}

          <span>
            <strong>
              {syncInfo?.sheetId
                ? 'ดึงอัตโนมัติทำงานอยู่ (Google Maps API + Porter Sheet):'
                : 'ดึงอัตโนมัติจาก Google Maps ทำงานอยู่:'}
            </strong>{' '}
            ซิงก์ล่าสุด {formatThaiSyncTime(syncInfo?.lastSyncedAt || null)}
            {syncInfo?.lastSyncMessage ? ` · ${syncInfo.lastSyncMessage}` : ' · อัปเดตเข้าฐานข้อมูลอัตโนมัติทุกวัน 07:00 น.'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {syncInfo?.sheetUrl && (
            <a
              href={syncInfo.sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.openLink}
            >
              เปิด Google Sheet <HiArrowTopRightOnSquare size={15} />
            </a>
          )}
        </div>
      </div>

      {/* Top Score Cards Separated by Business (3 Businesses across 100% width) */}
      <div className={styles.businessGrid}>
        {locations.map(loc => {
          const brand = BUSINESS_BRAND[loc.businessKey] || BUSINESS_BRAND.GFS;
          const locReviews = reviews.filter(r => r.locationId === loc.id).slice(0, MAX_PER_BUSINESS);
          const total = Number(loc.totalReviews || 0);
          const hasReviewData = locReviews.length > 0;
          const repliedLatest = locReviews.filter(r => Boolean(r.replyText?.trim())).length;
          const hasReplyTracking =
            repliedLatest > 0 || locReviews.some(r => r.source === 'Porter Metrics Sheet');
          const fiveStarCount = locReviews.filter(r => r.rating === 5).length;
          const fiveStarPct = hasReviewData ? Math.round((fiveStarCount / locReviews.length) * 100) : 100;
          const latestDate = locReviews[0]?.reviewDate || loc.lastReviewAt || '';
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
                  <span className={styles.metricValue}>{total.toLocaleString()}</span>
                  <span className={styles.metricLabel}>รีวิวสะสมทั้งหมด</span>
                </div>
                <div className={styles.metricCell}>
                  <span className={styles.metricValue} style={{ color: '#059669' }}>
                    {locReviews.length}{' '}
                    <small style={{ fontSize: '0.72rem', fontWeight: 500 }}>/ {MAX_PER_BUSINESS}</small>
                  </span>
                  <span className={styles.metricLabel}>รีวิวล่าสุดในระบบ</span>
                </div>
                <div className={styles.metricCell}>
                  {hasReplyTracking && hasReviewData ? (
                    <>
                      <span className={styles.metricValue} style={{ color: '#034aad' }}>
                        {repliedLatest}{' '}
                        <small style={{ fontSize: '0.72rem', fontWeight: 500 }}>/ {locReviews.length}</small>
                      </span>
                      <span className={styles.metricLabel}>บันทึกตอบกลับแล้ว</span>
                    </>
                  ) : hasReviewData ? (
                    <>
                      <span className={styles.metricValue} style={{ color: '#d97706' }}>
                        {fiveStarPct}%{' '}
                        <small style={{ fontSize: '0.72rem', fontWeight: 500 }}>({fiveStarCount})</small>
                      </span>
                      <span className={styles.metricLabel}>รีวิว 5 ดาว (ชุดล่าสุด)</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.metricValue} style={{ color: '#94a3b8' }}>—</span>
                      <span className={styles.metricLabel}>กำลังซิงก์ข้อมูล…</span>
                    </>
                  )}
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
                    รีวิวล่าสุด: {latestDate || 'กำลังโหลด…'}
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

      {/* 10 Latest Reviews per Business */}
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
              ข้อมูลรีวิวที่ดึงมาเก็บไว้ในฐานข้อมูล (แสดงธุรกิจละ {MAX_PER_BUSINESS} รายการล่าสุด)
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
                      ยังไม่มีรีวิวในฐานข้อมูลสำหรับ {brand.shortTitle} (ผูก Google Sheet ด้านบนเพื่อให้ระบบดึงเข้าอัตโนมัติ)
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

      {/* Modal: Configure Porter Metrics -> Google Sheet Auto-Sync */}
      <Modal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        title="ตั้งค่าดึงรีวิวอัตโนมัติ (Porter Metrics → Google Sheet → ฐานข้อมูล)"
        maxWidth="620px"
      >
        <form onSubmit={handleSaveSheetAndSync}>
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: '#334155',
            }}
          >
            <div style={{ fontWeight: 700, color: '#0f2942', marginBottom: '0.4rem' }}>
              วิธีตั้งค่าครั้งเดียว แล้วระบบดึงเข้าฐานข้อมูลเองทุกวัน (ฟรี 100%):
            </div>
            <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.35rem' }}>
              <li>
                สร้างไฟล์ Google Sheet 1 ไฟล์ แล้วเปิดส่วนเสริม <b>Extensions → Porter Metrics → Launch</b>{' '}
                เลือกแหล่งข้อมูล <b>Google Business Profile</b> (เลือกทั้ง 3 สถานที่ในแท็บเดียว หรือแยกแท็บ{' '}
                <code>GFS</code>, <code>MHL</code>, <code>CAR</code> ก็ได้)
              </li>
              <li>
                เลือกฟิลด์รีวิวใน Porter (เช่น <code>Location Name</code>, <code>Date</code>, <code>Reviewer</code>,{' '}
                <code>Star Rating</code>, <code>Review Comment</code>, <code>Review Reply Comment</code> รวมถึง{' '}
                <code>Total Reviews</code>, <code>Average Rating</code>) และตั้งเวลา{' '}
                <b>Schedule Refresh = Daily (รายวัน)</b>
              </li>
              <li>
                กดปุ่ม <b>Share (แชร์)</b> ใน Google Sheet แล้วเพิ่มอีเมลระบบของเว็บด้านล่างเป็น <b>Viewer (ผู้มีสิทธิ์อ่าน)</b>:
                {syncInfo?.serviceAccountEmail ? (
                  <div
                    style={{
                      marginTop: '0.35rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0.35rem 0.65rem',
                    }}
                  >
                    <code style={{ flex: 1, fontSize: '0.8rem', wordBreak: 'break-all', color: '#0f2942' }}>
                      {syncInfo.serviceAccountEmail}
                    </code>
                    <button
                      type="button"
                      onClick={copyServiceEmail}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        border: '1px solid #bfdbfe',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <HiClipboardDocument size={14} /> คัดลอก
                    </button>
                  </div>
                ) : null}
              </li>
              <li>วางลิงก์ Google Sheet ด้านล่าง แล้วกด <b>บันทึกและดึงข้อมูลทันที</b></li>
            </ol>
          </div>

          <div className="form-group">
            <label className="form-label">ลิงก์ Google Sheet (URL หรือ Sheet ID)</label>
            <input
              type="text"
              className="form-input"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrlInput}
              onChange={e => setSheetUrlInput(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsSheetModalOpen(false)}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary" disabled={savingSheet}>
              {savingSheet ? 'กำลังเชื่อมและดึงข้อมูล…' : 'บันทึกและดึงข้อมูลทันที'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Single GBP Review */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="บันทึกรีวิวบน Google Maps เสริม"
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
              placeholder="ข้อความรีวิว..."
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
