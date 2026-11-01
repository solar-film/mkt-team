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
} from 'react-icons/hi2';
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
  {
    id: 'line-messaging-api',
    name: 'LINE Messaging API',
    status: 'ใช้งานอยู่',
    description: 'แจ้งเตือนงานใหม่ คอนเทนต์ กิจกรรม และงานใกล้ครบกำหนดเข้ากลุ่ม LINE',
    source: 'เว็บ MKT (Tasks · Content · Cron)',
    destination: 'กลุ่ม LINE ทีมการตลาด (GFS & MHL)',
    syncSchedule: 'ส่งทันทีเมื่อสร้าง/อัปเดตงาน และ Cron แจ้งเตือนทุกวัน 08:00 น.',
    lifespan: 'Long-lived Channel Access Token ใช้ได้ไม่จำกัดเวลา',
    cost: 'ฟรี (แพ็กเกจเริ่มต้น LINE Official Account)',
    usageLimit: 'Push Message ตามโควตารายเดือนของบัญชี LINE OA',
    linkLabel: 'เปิด LINE Developers',
    linkUrl: 'https://developers.line.biz/console/',
    checkedAt: 'ตรวจ 1 พ.ย. 69',
    sortOrder: 2,
  },
  {
    id: 'supabase-postgres',
    name: 'Supabase PostgreSQL',
    status: 'ใช้งานอยู่',
    description: 'ฐานข้อมูลหลักของเว็บ MKT เก็บงาน คอนเทนต์ KPI โน๊ตไอเดีย และสถิติเพจ',
    source: 'Supabase Cloud (PostgreSQL)',
    destination: 'เว็บ MKT (ทุกเมนูในระบบ)',
    syncSchedule: 'เชื่อมต่อแบบ Real-time ตลอดเวลาผ่าน Prisma ORM',
    lifespan: 'ใช้ได้ไม่จำกัดเวลา (Free Tier ต้องมีการเรียกใช้งานอย่างน้อยทุก 7 วัน)',
    cost: 'ฟรี (Free Plan · พื้นที่ฐานข้อมูล 500 MB)',
    usageLimit: 'ใช้งานจริง 11 ตารางหลัก รองรับการบันทึกสถิติรายเดือนและ D+7/15/30',
    linkLabel: 'เปิด Supabase',
    linkUrl: 'https://supabase.com/dashboard',
    checkedAt: 'ตรวจ 1 พ.ย. 69',
    sortOrder: 3,
  },
  {
    id: 'google-sheets-sync',
    name: 'Google Sheets API',
    status: 'สำรองข้อมูล',
    description: 'เชื่อมต่อ Google Sheets ด้วย Service Account สำหรับดึงหรือสำรองข้อมูล KPI',
    source: 'Google Sheets (ตาราง KPI ทีมการตลาด)',
    destination: 'เว็บ MKT (ระบบนำเข้า KPI)',
    syncSchedule: 'ดึงข้อมูลเฉพาะเมื่อกดซิงก์หรือรันคำสั่งนำเข้า',
    lifespan: 'Service Account Key ใช้ได้ไม่จำกัดเวลาจนกว่าจะยกเลิกสิทธิ์',
    cost: 'ฟรี (Google Cloud Free Quota)',
    usageLimit: 'อ่านและแปลงข้อมูลตารางเป้าหมาย KPI รายเดือนเข้าสู่ฐานข้อมูล',
    linkLabel: 'เปิด Google Sheets',
    linkUrl: 'https://docs.google.com/spreadsheets/d/1t0SA9gkJuQjvJbq1iPtAyWPqkX2NeLgtUI4DagU_K0U',
    checkedAt: 'ตรวจ 1 พ.ย. 69',
    sortOrder: 4,
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
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ToolIntegration | null>(null);

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
      const res = await fetch('/api/integrations', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
        }
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
      const res = await fetch('/api/integrations', {
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
      await fetch('/api/integrations', {
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
      await fetch('/api/integrations', {
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
      const res = await fetch(`/api/integrations?id=${deleteTarget.id}`, {
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

  const activeCount = items.filter(i => i.status === 'ใช้งานอยู่').length;
  const unusedCount = items.filter(i => i.status === 'ไม่ได้ใช้').length;
  const freeCount = items.filter(i => i.cost.includes('ฟรี') || i.cost.toLowerCase().includes('free')).length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.eyebrow}>
            <HiGlobeAlt size={14} /> Data Sources &amp; Marketing Stack
          </span>
          <h1 className={styles.pageTitle}>ระบบเชื่อมต่อ &amp; เครื่องมือการตลาด</h1>
          <p className={styles.pageSubtitle}>
            ติดตามสถานะเครื่องมือ แหล่งดึงข้อมูล อายุแพ็กเกจ ค่าใช้จ่าย และการส่งข้อมูลเข้าเว็บ MKT
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.addBtn} onClick={openCreateModal}>
            <HiPlus size={18} /> เพิ่มเครื่องมือ / ระบบเชื่อมต่อ
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#eef2ff', color: '#4f46e5' }}>
            <HiGlobeAlt />
          </div>
          <div>
            <div className={styles.summaryValue}>{items.length}</div>
            <div className={styles.summaryLabel}>ระบบและเครื่องมือทั้งหมด</div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
            <HiCheckBadge />
          </div>
          <div>
            <div className={styles.summaryValue} style={{ color: '#059669' }}>{activeCount}</div>
            <div className={styles.summaryLabel}>เชื่อมต่อใช้งานอยู่</div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#f1f5f9', color: '#52606d' }}>
            <HiOutlinePauseCircle />
          </div>
          <div>
            <div className={styles.summaryValue} style={{ color: '#52606d' }}>{unusedCount}</div>
            <div className={styles.summaryLabel}>ไม่ได้ใช้ / ยังไม่ส่งเข้าเว็บ MKT</div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#eff6ff', color: '#0284c7' }}>
            <HiOutlineSparkles />
          </div>
          <div>
            <div className={styles.summaryValue} style={{ color: '#0284c7' }}>{freeCount}</div>
            <div className={styles.summaryLabel}>แพ็กเกจฟรี (ไม่มีค่าใช้จ่ายรายเดือน)</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
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
            placeholder="ค้นหาชื่อเครื่องมือ, แหล่งข้อมูล, ค่าใช้จ่าย..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Cards Grid */}
      {loading && items.length === 0 ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px dashed #cbd5e1',
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem', color: '#0f2942' }}>
            ไม่พบรายการเครื่องมือที่ค้นหา
          </p>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            ลองเปลี่ยนตัวกรองด้านบน หรือกดปุ่ม &ldquo;เพิ่มเครื่องมือ / ระบบเชื่อมต่อ&rdquo;
          </p>
        </div>
      ) : (
        <div className={styles.cardsGrid}>
          {filteredItems.map(item => (
            <article key={item.id} className={styles.card}>
              {/* Header: Name + Status Pill */}
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

              {/* Subtitle / Description */}
              <p className={styles.cardDesc}>{item.description || '-'}</p>

              {/* Flow Pills: Source -> Destination */}
              <div className={styles.flowContainer}>
                <span className={styles.flowPill}>{item.source || 'ไม่ระบุต้นทาง'}</span>
                <span className={styles.flowArrow} aria-hidden="true">→</span>
                <span className={styles.flowPill}>{item.destination || '— (ยังไม่ได้ต่อเข้าเว็บ MKT)'}</span>
              </div>

              {/* 4 Metadata Rows */}
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

              {/* Footer: Link on left, Checked date + Edit/Delete on right */}
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
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'แก้ไขข้อมูลเครื่องมือ / ระบบเชื่อมต่อ' : 'เพิ่มเครื่องมือ / ระบบเชื่อมต่อใหม่'}
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
                placeholder="เช่น Porter Metrics, Looker Studio, Meta Ads"
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
                placeholder="เช่น — (ยังไม่ได้ต่อเข้าเว็บ MKT)"
                value={formData.destination}
                onChange={e => setFormData({ ...formData, destination: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">🔄 ดึงเมื่อ (ความถี่ในการดึงข้อมูล)</label>
              <input
                type="text"
                className="form-input"
                placeholder="เช่น ถามผ่าน AI เมื่อต้องการ"
                value={formData.syncSchedule}
                onChange={e => setFormData({ ...formData, syncSchedule: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">💵 ค่าใช้จ่าย</label>
              <input
                type="text"
                className="form-input"
                placeholder="เช่น ฟรี (Free forever) สำหรับ Google Business Profile"
                value={formData.cost}
                onChange={e => setFormData({ ...formData, cost: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">📅 อายุการใช้งาน / เงื่อนไขแพ็กเกจ</label>
            <input
              type="text"
              className="form-input"
              placeholder="เช่น ทดลองฟีเจอร์เต็ม 14 วัน แล้วเป็นแพ็กเกจ Free ใช้ได้ไม่จำกัดเวลา"
              value={formData.lifespan}
              onChange={e => setFormData({ ...formData, lifespan: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">🕒 ใช้ไป / ขอบเขตการดูข้อมูลย้อนหลัง</label>
            <input
              type="text"
              className="form-input"
              placeholder="เช่น ถามผ่าน AI ย้อนหลังได้ 15 วัน · รายงานทั่วไปย้อนหลังได้ถึง 30 วัน"
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
                placeholder="เช่น เปิด Porter"
                value={formData.linkLabel}
                onChange={e => setFormData({ ...formData, linkLabel: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">URL ลิงก์ปลายทาง</label>
              <input
                type="text"
                className="form-input"
                placeholder="https://..."
                value={formData.linkUrl}
                onChange={e => setFormData({ ...formData, linkUrl: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">วันที่ตรวจล่าสุด</label>
              <input
                type="text"
                className="form-input"
                placeholder="ตรวจ 1 พ.ย. 69"
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
