'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  HiPlus,
  HiArrowPath,
  HiOutlineCalendarDays,
  HiOutlineBanknotes,
  HiClock,
  HiArrowTopRightOnSquare,
  HiPencilSquare,
  HiOutlineTrash,
  HiMagnifyingGlass,
  HiGlobeAlt,
  HiCheckBadge,
  HiOutlinePauseCircle,
  HiOutlineSparkles,
  HiStar,
  HiMapPin,
  HiChatBubbleLeftEllipsis,
} from 'react-icons/hi2';
import { fetchWorkspace } from '@/lib/workspace-fetch';
import Modal from '@/components/Modal';
import ConfirmModal from '@/components/ConfirmModal';
import styles from './integrations.module.css';

interface ToolIntegration {
  id: string;
  name: string;
  status: string;
  description: string;
  source: string;
  destination: string;
  syncSchedule: string;
  lifespan: string;
  cost: string;
  usageLimit: string;
  linkLabel: string;
  linkUrl: string;
  checkedAt: string;
  sortOrder?: number;
}

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

const INITIAL_FALLBACK_ITEMS: ToolIntegration[] = [
  {
    id: 'porter-metrics',
    name: 'Porter Metrics',
    status: 'ไม่ได้ใช้',
    description: 'ตรวจรีวิว Google Business Profile · ยังไม่ส่งเข้าเว็บ MKT',
    source: 'Google Business Profile 1 บัญชี / 3 สถานที่',
    destination: '— (ยังไม่ได้ต่อเข้าเว็บ MKT)',
    syncSchedule: 'ถามผ่าน AI เมื่อต้องการ',
    lifespan: 'ทดลองฟีเจอร์เต็ม 14 วัน แล้วเป็นแพ็กเกจ Free ใช้ได้ไม่จำกัดเวลา',
    cost: 'ฟรี (Free forever) สำหรับ Google Business Profile',
    usageLimit: 'ถามผ่าน AI ย้อนหลังได้ 15 วัน · รายงานทั่วไปย้อนหลังได้ถึง 30 วัน',
    linkLabel: 'เปิด Porter',
    linkUrl: 'https://portermetrics.com/',
    checkedAt: 'ตรวจ 1 พ.ย. 69',
    sortOrder: 1,
  },
];

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

function getTodayThaiShort(): string {
  const d = new Date();
  const formatted = d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
  return `ตรวจ ${formatted}`;
}

export default function IntegrationsPage() {
  const [items, setItems] = useState<ToolIntegration[]>(INITIAL_FALLBACK_ITEMS);
  const [locations, setLocations] = useState<GbpLocation[]>(INITIAL_LOCATIONS);
  const [reviews, setReviews] = useState<GbpReview[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedLocFilter, setSelectedLocFilter] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');

  // Tool Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ToolIntegration | null>(null);

  // Review Modal state
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

  // Reply Modal state
  const [replyTarget, setReplyTarget] = useState<GbpReview | null>(null);
  const [replyForm, setReplyForm] = useState({ replyText: '', repliedBy: '' });

  // Location Edit Modal state
  const [locEditTarget, setLocEditTarget] = useState<GbpLocation | null>(null);
  const [locForm, setLocForm] = useState({
    rating: 4.9,
    totalReviews: 0,
    repliedCount: 0,
    lastReviewAt: '',
  });

  const emptyForm = {
    name: '',
    status: 'ไม่ได้ใช้',
    description: '',
    source: '',
    destination: '— (ยังไม่ได้ต่อเข้าเว็บ MKT)',
    syncSchedule: '',
    lifespan: '',
    cost: '',
    usageLimit: '',
    linkLabel: '',
    linkUrl: '',
    checkedAt: getTodayThaiShort(),
  };

  const [formData, setFormData] = useState(emptyForm);

  const fetchItems = async () => {
    try {
      const res = await fetchWorkspace('/api/integrations', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) setItems(data.items);
        if (Array.isArray(data.locations) && data.locations.length > 0) setLocations(data.locations);
        if (Array.isArray(data.reviews)) setReviews(data.reviews);
      }
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const getStatusClass = (status: string) => {
    if (status === 'ใช้งานอยู่') return styles.statusActive;
    if (status === 'ทดลองใช้') return styles.statusTrial;
    if (status === 'สำรองข้อมูล') return styles.statusBackup;
    return styles.statusUnused;
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      ...emptyForm,
      checkedAt: getTodayThaiShort(),
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: ToolIntegration) => {
    setIsEditing(true);
    setEditingId(item.id);
    setFormData({
      name: item.name,
      status: item.status,
      description: item.description,
      source: item.source,
      destination: item.destination,
      syncSchedule: item.syncSchedule,
      lifespan: item.lifespan,
      cost: item.cost,
      usageLimit: item.usageLimit,
      linkLabel: item.linkLabel,
      linkUrl: item.linkUrl,
      checkedAt: item.checkedAt,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const payload = isEditing ? { id: editingId, ...formData } : formData;
      const res = await fetchWorkspace('/api/integrations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isEditing ? 'บันทึกการแก้ไขเรียบร้อย' : 'เพิ่มรายการใหม่เรียบร้อย');
        setIsModalOpen(false);
        fetchItems();
      } else {
        toast.error('ไม่สามารถบันทึกข้อมูลได้');
      }
    } catch (error) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  const handleQuickToggleStatus = async (item: ToolIntegration) => {
    const statusOrder = ['ไม่ได้ใช้', 'ใช้งานอยู่', 'ทดลองใช้', 'สำรองข้อมูล'];
    const nextIndex = (statusOrder.indexOf(item.status) + 1) % statusOrder.length;
    const nextStatus = statusOrder[nextIndex];
    const updatedItem = { ...item, status: nextStatus, checkedAt: getTodayThaiShort() };

    setItems(prev => prev.map(i => (i.id === item.id ? updatedItem : i)));

    try {
      await fetchWorkspace('/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedItem),
      });
      toast.success(`เปลี่ยนสถานะ ${item.name} เป็น "${nextStatus}"`);
    } catch (error) {
      console.error(error);
      fetchItems();
    }
  };

  const handleStampToday = async (item: ToolIntegration) => {
    const todayStr = getTodayThaiShort();
    const updatedItem = { ...item, checkedAt: todayStr };
    setItems(prev => prev.map(i => (i.id === item.id ? updatedItem : i)));

    try {
      await fetchWorkspace('/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedItem),
      });
      toast.success(`อัปเดตวันที่ตรวจของ ${item.name} เป็นวันนี้แล้ว`);
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWorkspace(`/api/integrations?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(`ลบ "${deleteTarget.name}" เรียบร้อย`);
        setDeleteTarget(null);
        fetchItems();
      } else {
        toast.error('ไม่สามารถลบข้อมูลได้');
      }
    } catch (error) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาดในการลบ');
    }
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWorkspace('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'review', ...reviewForm }),
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
        fetchItems();
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
        fetchItems();
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
        fetchItems();
      }
    } catch (error) {
      console.error(error);
      toast.error('ไม่สามารถอัปเดตสถิติได้');
    }
  };

  const handleDeleteReview = async (id: string) => {
    try {
      const res = await fetchWorkspace(`/api/integrations?id=${id}&kind=review`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('ลบรีวิวเรียบร้อย');
        fetchItems();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesStatus =
      filterStatus === 'ทั้งหมด'
        ? true
        : filterStatus === 'อื่นๆ'
        ? item.status !== 'ใช้งานอยู่' && item.status !== 'ไม่ได้ใช้'
        : item.status === filterStatus;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchesStatus;

    const matchesSearch =
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q) ||
      item.destination.toLowerCase().includes(q) ||
      item.cost.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  const filteredReviews = reviews.filter(r =>
    selectedLocFilter === 'ALL' ? true : r.locationId === selectedLocFilter
  );

  const totalReviewsAll = locations.reduce((acc, l) => acc + Number(l.totalReviews || 0), 0);
  const totalRepliedAll = locations.reduce((acc, l) => acc + Number(l.repliedCount || 0), 0);
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
            <HiGlobeAlt size={14} /> Porter Metrics · Google Business Profile (1 บัญชี / 3 สถานที่)
          </span>
          <h1 className={styles.pageTitle}>ตรวจรีวิว Google Business Profile &amp; ระบบเชื่อมต่อ</h1>
          <p className={styles.pageSubtitle}>
            ติดตามคะแนนรีวิว Google Business Profile ทั้ง 3 สถานที่ (GOODFILM, มโหฬารฟิล์ม, MHL CARFILM) และจัดการการ์ด Porter Metrics
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsReviewModalOpen(true)}
            style={{ borderRadius: '12px', fontWeight: 600 }}
          >
            <HiPlus size={18} /> บันทึกรีวิว GBP ใหม่
          </button>
          <button type="button" className={styles.addBtn} onClick={openCreateModal}>
            <HiPlus size={18} /> เพิ่มการ์ดระบบเชื่อมต่อ
          </button>
        </div>
      </div>

      {/* Summary Cards for GBP 1 Account / 3 Locations */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
            <HiStar />
          </div>
          <div>
            <div className={styles.summaryValue} style={{ color: '#b45309' }}>{weightedRating} ★</div>
            <div className={styles.summaryLabel}>คะแนนเฉลี่ยรวม 3 สถานที่ (GBP)</div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#eef2ff', color: '#4f46e5' }}>
            <HiChatBubbleLeftEllipsis />
          </div>
          <div>
            <div className={styles.summaryValue}>{totalReviewsAll}</div>
            <div className={styles.summaryLabel}>รีวิวสะสมทั้งหมด (1 บัญชี / 3 สถานที่)</div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
            <HiCheckBadge />
          </div>
          <div>
            <div className={styles.summaryValue} style={{ color: '#059669' }}>{replyPercent}%</div>
            <div className={styles.summaryLabel}>อัตราการตอบกลับรีวิว ({totalRepliedAll}/{totalReviewsAll})</div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#eff6ff', color: '#0284c7' }}>
            <HiOutlineSparkles />
          </div>
          <div>
            <div className={styles.summaryValue} style={{ color: '#0284c7' }}>Free Forever</div>
            <div className={styles.summaryLabel}>Porter Metrics (ดูย้อนหลัง 15-30 วัน)</div>
          </div>
        </div>
      </div>

      {/* Section 1: Porter Metrics & Integration Cards (Exact Design from Screenshot) */}
      <div style={{ marginBottom: '2rem' }}>
        <div className={styles.toolbar}>
          <div className={styles.filterTabs}>
            {['ทั้งหมด', 'ใช้งานอยู่', 'ไม่ได้ใช้', 'อื่นๆ'].map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterStatus(tab)}
                className={`${styles.filterTab} ${filterStatus === tab ? styles.filterTabActive : ''}`}
              >
                {tab === 'อื่นๆ' ? 'สำรอง / ทดลองใช้' : tab}
              </button>
            ))}
          </div>

          <div className={styles.searchWrap}>
            <HiMagnifyingGlass className={styles.searchIcon} size={18} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="ค้นหา Porter Metrics, Windsor, Make..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.cardsGrid}>
          {filteredItems.map(item => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardTop}>
                <h2 className={styles.cardTitle}>{item.name}</h2>
                <button
                  type="button"
                  onClick={() => handleQuickToggleStatus(item)}
                  className={`${styles.statusBadge} ${getStatusClass(item.status)}`}
                  title="คลิกเพื่อสลับสถานะ"
                >
                  {item.status}
                </button>
              </div>

              <p className={styles.cardDesc}>{item.description || '-'}</p>

              <div className={styles.flowContainer}>
                <span className={styles.flowPill}>{item.source || 'ไม่ระบุต้นทาง'}</span>
                <span className={styles.flowArrow} aria-hidden="true">→</span>
                <span className={styles.flowPill}>{item.destination || '— (ยังไม่ได้ต่อเข้าเว็บ MKT)'}</span>
              </div>

              <div className={styles.infoList}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    <HiArrowPath className={styles.infoIcon} />
                    ดึงเมื่อ
                  </span>
                  <span className={styles.infoValue}>{item.syncSchedule || '-'}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    <HiOutlineCalendarDays className={styles.infoIcon} />
                    อายุ
                  </span>
                  <span className={styles.infoValue}>{item.lifespan || '-'}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    <HiOutlineBanknotes className={styles.infoIcon} />
                    ค่าใช้จ่าย
                  </span>
                  <span className={styles.infoValue}>{item.cost || '-'}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    <HiClock className={styles.infoIcon} />
                    ใช้ไป
                  </span>
                  <span className={styles.infoValue}>{item.usageLimit || '-'}</span>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <div>
                  {item.linkUrl ? (
                    <a
                      href={item.linkUrl.startsWith('http') ? item.linkUrl : `https://${item.linkUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.openLink}
                    >
                      {item.linkLabel || `เปิด ${item.name}`}
                      <HiArrowTopRightOnSquare size={16} />
                    </a>
                  ) : (
                    <span className={styles.openLinkMuted}>{item.linkLabel || 'ไม่มีลิงก์'}</span>
                  )}
                </div>

                <div className={styles.footerRight}>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => openEditModal(item)}
                      title="แก้ไขข้อมูล"
                    >
                      <HiPencilSquare size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={() => setDeleteTarget(item)}
                      title="ลบรายการ"
                    >
                      <HiOutlineTrash size={16} />
                    </button>
                  </div>
                  <span
                    className={styles.checkedText}
                    onClick={() => handleStampToday(item)}
                    title="คลิกเพื่ออัปเดตเป็นวันที่ตรวจวันนี้"
                  >
                    {item.checkedAt || getTodayThaiShort()}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Section 2: Google Business Profile 3 Locations Breakdown */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f2942', margin: 0 }}>
              สถานที่ใน Google Business Profile (1 บัญชี / 3 สถานที่)
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#5a6f86', margin: '0.2rem 0 0' }}>
              คลิกปุ่มดินสอที่แต่ละสาขาเพื่ออัปเดตยอดรีวิวสะสม หรือกดลิงก์เพื่อดูใน Google Maps
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
                  <span className={styles.flowPill}>รีวิวทั้งหมด {loc.totalReviews} รายการ</span>
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

      {/* Section 3: Recent GBP Reviews & Reply Log */}
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
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f2942', margin: 0 }}>
              รายการตรวจรีวิวล่าสุด (Google Business Profile)
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#5a6f86', margin: '0.2rem 0 0' }}>
              บันทึกและติดตามการตอบกลับรีวิวของลูกค้าจาก Porter Metrics / Google Maps
            </p>
          </div>

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
        </div>

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: '#0f2942', marginRight: '0.5rem' }}>{rev.reviewerName}</span>
                    <span style={{ color: '#d97706', fontWeight: 700, fontSize: '0.9rem' }}>
                      {'★'.repeat(rev.rating)}{'☆'.repeat(Math.max(0, 5 - rev.rating))}
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
                        setReplyForm({ replyText: rev.replyText || '', repliedBy: rev.repliedBy || '' });
                      }}
                      title="ตอบกลับรีวิว"
                    >
                      <HiPencilSquare size={15} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={() => handleDeleteReview(rev.id)}
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
      </div>

      {/* Modal: Add/Edit Integration Tool */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'แก้ไขการ์ดระบบเชื่อมต่อ' : 'เพิ่มการ์ดระบบเชื่อมต่อใหม่'}
        maxWidth="640px"
      >
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">ชื่อเครื่องมือ / ระบบ *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="เช่น Porter Metrics"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">สถานะ *</label>
              <select
                className="form-select"
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ไม่ได้ใช้">ไม่ได้ใช้</option>
                <option value="ใช้งานอยู่">ใช้งานอยู่</option>
                <option value="ทดลองใช้">ทดลองใช้</option>
                <option value="สำรองข้อมูล">สำรองข้อมูล</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">คำอธิบายสั้นๆ (หน้าที่และการส่งข้อมูล)</label>
            <input
              type="text"
              className="form-input"
              placeholder="เช่น ตรวจรีวิว Google Business Profile · ยังไม่ส่งเข้าเว็บ MKT"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">ต้นทางข้อมูล (Source)</label>
              <input
                type="text"
                className="form-input"
                placeholder="เช่น Google Business Profile 1 บัญชี / 3 สถานที่"
                value={formData.source}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">ปลายทาง (Destination)</label>
              <input
                type="text"
                className="form-input"
                placeholder="เช่น หน้า รีวิว GBP / Porter"
                value={formData.destination}
                onChange={e => setFormData({ ...formData, destination: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">🔄 ดึงเมื่อ</label>
              <input
                type="text"
                className="form-input"
                value={formData.syncSchedule}
                onChange={e => setFormData({ ...formData, syncSchedule: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">💵 ค่าใช้จ่าย</label>
              <input
                type="text"
                className="form-input"
                value={formData.cost}
                onChange={e => setFormData({ ...formData, cost: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">📅 อายุการใช้งาน</label>
            <input
              type="text"
              className="form-input"
              value={formData.lifespan}
              onChange={e => setFormData({ ...formData, lifespan: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">🕒 ใช้ไป</label>
            <input
              type="text"
              className="form-input"
              value={formData.usageLimit}
              onChange={e => setFormData({ ...formData, usageLimit: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">ข้อความปุ่มลิงก์</label>
              <input
                type="text"
                className="form-input"
                value={formData.linkLabel}
                onChange={e => setFormData({ ...formData, linkLabel: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">URL ลิงก์ปลายทาง</label>
              <input
                type="text"
                className="form-input"
                value={formData.linkUrl}
                onChange={e => setFormData({ ...formData, linkUrl: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">วันที่ตรวจล่าสุด</label>
              <input
                type="text"
                className="form-input"
                value={formData.checkedAt}
                onChange={e => setFormData({ ...formData, checkedAt: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              บันทึกข้อมูล
            </button>
          </div>
        </form>
      </Modal>

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
              required
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="ยืนยันการลบรายการ"
        message={`คุณต้องการลบ "${deleteTarget?.name || ''}" ออกจากหน้าระบบเชื่อมต่อใช่หรือไม่?`}
      />
    </div>
  );
}
