'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  HiPlus,
  HiArrowTopRightOnSquare,
  HiPencilSquare,
  HiOutlineTrash,
  HiMagnifyingGlass,
  HiCheckBadge,
  HiStar,
  HiMapPin,
  HiChatBubbleLeftEllipsis,
  HiClock,
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
  const [loading, setLoading] = useState(true);

  const [selectedLocFilter, setSelectedLocFilter] = useState<string>('ALL');
  const [replyFilter, setReplyFilter] = useState<'ALL' | 'UNREPLIED' | 'REPLIED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Review Modal
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

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWorkspace('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewForm),
      });
      if (res.ok) {
        toast.success('บันทึกรีวิว Google Business Profile เรียบร้อย');
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
        toast.success(`อัปเดตสถิติรีวิวของ ${locEditTarget.name} เรียบร้อย`);
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

  const filteredReviews = reviews.filter(r => {
    if (selectedLocFilter !== 'ALL' && r.locationId !== selectedLocFilter) return false;
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
  });

  const totalReviewsAll = locations.reduce((acc, l) => acc + Number(l.totalReviews || 0), 0);
  const totalRepliedAll = locations.reduce((acc, l) => acc + Number(l.repliedCount || 0), 0);
  const totalUnrepliedAll = Math.max(0, totalReviewsAll - totalRepliedAll);
  const weightedRating =
    totalReviewsAll > 0
      ? (
          locations.reduce((acc, l) => acc + Number(l.rating || 5) * Number(l.totalReviews || 0), 0) /
          totalReviewsAll
        ).toFixed(2)
      : '4.90';
  const replyPercent = totalReviewsAll > 0 ? Math.round((totalRepliedAll / totalReviewsAll) * 100) : 100;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.eyebrow}>
            <HiStar size={14} /> Google Business Profile · 1 บัญชี / 3 สถานที่
          </span>
          <h1 className={styles.pageTitle}>ตรวจรีวิว Google Business Profile</h1>
          <p className={styles.pageSubtitle}>
            ติดตามคะแนนดาวและบันทึกการตอบกลับรีวิวทั้ง 3 สถานที่ (GOODFILM, มโหฬารฟิล์ม อาคาร, MHL CARFILM)
          </p>
        </div>
        <div className={styles.headerActions}>
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
            เปิด Porter Metrics <HiArrowTopRightOnSquare size={16} />
          </a>
          <button type="button" className={styles.addBtn} onClick={() => setIsReviewModalOpen(true)}>
            <HiPlus size={18} /> บันทึกรีวิว GBP ใหม่
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
            <HiStar />
          </div>
          <div>
            <div className={styles.summaryValue} style={{ color: '#b45309' }}>{weightedRating} ★</div>
            <div className={styles.summaryLabel}>คะแนนเฉลี่ยรวม 3 สถานที่</div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#eef2ff', color: '#4f46e5' }}>
            <HiChatBubbleLeftEllipsis />
          </div>
          <div>
            <div className={styles.summaryValue}>{totalReviewsAll}</div>
            <div className={styles.summaryLabel}>รีวิวสะสมทั้งหมด (3 สถานที่)</div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
            <HiCheckBadge />
          </div>
          <div>
            <div className={styles.summaryValue} style={{ color: '#059669' }}>{replyPercent}%</div>
            <div className={styles.summaryLabel}>อัตราการตอบกลับ ({totalRepliedAll}/{totalReviewsAll})</div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div
            className={styles.summaryIcon}
            style={{
              backgroundColor: totalUnrepliedAll > 0 ? '#fff7ed' : '#f1f5f9',
              color: totalUnrepliedAll > 0 ? '#ea580c' : '#64748b',
            }}
          >
            <HiClock />
          </div>
          <div>
            <div
              className={styles.summaryValue}
              style={{ color: totalUnrepliedAll > 0 ? '#ea580c' : '#475569' }}
            >
              {totalUnrepliedAll}
            </div>
            <div className={styles.summaryLabel}>รีวิวที่รอตอบกลับ</div>
          </div>
        </div>
      </div>

      {/* Section 1: 3 Google Business Profile Locations */}
      <div style={{ marginBottom: '2rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f2942', margin: 0 }}>
              ภาพรวมรายสถานที่ (1 บัญชี / 3 สถานที่)
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#5a6f86', margin: '0.2rem 0 0' }}>
              กดไอคอนดินสอเพื่อปรับปรุงยอดรีวิวสะสม หรือกดเปิด Google Maps เพื่อตรวจหน้าร้านจริง
            </p>
          </div>
        </div>

        <div className={styles.cardsGrid}>
          {locations.map(loc => {
            const unreplied = Math.max(0, loc.totalReviews - loc.repliedCount);
            return (
              <article key={loc.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <h3 className={styles.cardTitle} style={{ fontSize: '1.1rem' }}>{loc.name}</h3>
                  <span
                    className={styles.statusBadge}
                    style={{ backgroundColor: '#fef3c7', color: '#b45309', cursor: 'default' }}
                  >
                    ★ {Number(loc.rating).toFixed(1)}
                  </span>
                </div>

                <p className={styles.cardDesc} style={{ marginBottom: '0.75rem' }}>
                  <HiMapPin style={{ verticalAlign: 'text-bottom', marginRight: '0.25rem' }} />
                  {loc.address}
                </p>

                <div className={styles.flowContainer}>
                  <span className={styles.flowPill}>รีวิวสะสม {loc.totalReviews} รายการ</span>
                  <span className={styles.flowArrow}>→</span>
                  <span className={styles.flowPill}>
                    ตอบแล้ว {loc.repliedCount} รายการ {unreplied > 0 ? `(รอตอบ ${unreplied})` : '(ครบ 100%)'}
                  </span>
                </div>

                <div className={styles.infoList}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>ผู้ดูแลหลัก</span>
                    <span className={styles.infoValue}>{loc.owner}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>รีวิวล่าสุด</span>
                    <span className={styles.infoValue}>{loc.lastReviewAt || '-'}</span>
                  </div>
                </div>

                <div className={styles.cardFooter}>
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
                      title="อัปเดตตัวเลขรีวิวสาขานี้"
                    >
                      <HiPencilSquare size={16} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Section 2: Recent GBP Reviews & Reply Log */}
      <div
        style={{
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
              รายการตรวจรีวิวลูกค้า &amp; การตอบกลับ
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#5a6f86', margin: '0.2rem 0 0' }}>
              บันทึกข้อความรีวิวจากลูกค้าและติดตามสถานะการตอบกลับของแต่ละธุรกิจ
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div className={styles.filterTabs}>
              <button
                type="button"
                onClick={() => setSelectedLocFilter('ALL')}
                className={`${styles.filterTab} ${selectedLocFilter === 'ALL' ? styles.filterTabActive : ''}`}
              >
                ทุกสถานที่ ({reviews.length})
              </button>
              {locations.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedLocFilter(l.id)}
                  className={`${styles.filterTab} ${selectedLocFilter === l.id ? styles.filterTabActive : ''}`}
                >
                  {l.businessKey}
                </button>
              ))}
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

        <div style={{ marginBottom: '1.1rem' }}>
          <div className={styles.searchWrap} style={{ maxWidth: '100%' }}>
            <HiMagnifyingGlass className={styles.searchIcon} size={18} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="ค้นหาชื่อลูกค้า, ข้อความรีวิว, หรือผู้ตอบกลับ..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading && reviews.length === 0 ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div
            style={{
              borderRadius: '14px',
              border: '1px dashed #cbd5e1',
              padding: '2.5rem 1rem',
              textAlign: 'center',
              color: '#64748b',
            }}
          >
            ไม่พบรายการรีวิวตามตัวกรองที่เลือก
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filteredReviews.map(rev => {
              const loc = locations.find(l => l.id === rev.locationId);
              return (
                <div
                  key={rev.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '1rem 1.2rem',
                    backgroundColor: '#fcfdff',
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
                    <div>
                      <span style={{ fontWeight: 700, color: '#0f2942', marginRight: '0.5rem' }}>
                        {rev.reviewerName}
                      </span>
                      <span style={{ color: '#d97706', fontWeight: 700, fontSize: '0.9rem' }}>
                        {'★'.repeat(rev.rating)}
                        {'☆'.repeat(Math.max(0, 5 - rev.rating))}
                      </span>
                      <span
                        style={{
                          marginLeft: '0.6rem',
                          fontSize: '0.78rem',
                          padding: '0.15rem 0.55rem',
                          borderRadius: '999px',
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          fontWeight: 600,
                        }}
                      >
                        {loc?.name || rev.locationId}
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
                            repliedBy: rev.repliedBy || loc?.owner || '',
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

                  <p style={{ margin: '0.55rem 0', color: '#1e293b', fontSize: '0.92rem', lineHeight: 1.5 }}>
                    {rev.comment}
                  </p>

                  {rev.replyText ? (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.6rem 0.85rem',
                        backgroundColor: '#f0fdf4',
                        borderLeft: '3px solid #16a34a',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
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
                          setReplyForm({ replyText: '', repliedBy: loc?.owner || '' });
                        }}
                        style={{
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#034aad',
                          borderRadius: '8px',
                          padding: '0.3rem 0.7rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        + บันทึกคำตอบกลับรีวิว
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add GBP Review */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="บันทึกรีวิว Google Business Profile ใหม่"
        maxWidth="540px"
      >
        <form onSubmit={handleSaveReview}>
          <div className="form-group">
            <label className="form-label">สถานที่ (1 บัญชี / 3 สถานที่) *</label>
            <select
              className="form-select"
              value={reviewForm.locationId}
              onChange={e => setReviewForm({ ...reviewForm, locationId: e.target.value })}
            >
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
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
              placeholder="คัดลอกข้อความรีวิวจาก Porter Metrics หรือ Google Maps..."
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

      {/* Modal: Edit Location Summary */}
      <Modal
        isOpen={!!locEditTarget}
        onClose={() => setLocEditTarget(null)}
        title={`อัปเดตสถิติรีวิว: ${locEditTarget?.name || ''}`}
        maxWidth="460px"
      >
        <form onSubmit={handleSaveLocation}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">คะแนนเฉลี่ย (เต็ม 5.0)</label>
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
