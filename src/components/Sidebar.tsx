'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  HiChartBarSquare,
  HiClipboardDocumentList,
  HiChartBar,
  HiDocumentText,
  HiUserGroup,
  HiMegaphone,
  HiGlobeAlt,
  HiChevronLeft,
  HiChevronRight,
  HiCalendarDays,
  HiLockClosed,
  HiLockOpen,
  HiChartPie,
  HiLightBulb
} from 'react-icons/hi2';

const navLinks = [
  { path: '/', label: 'แดชบอร์ด', icon: <HiChartBarSquare /> },
  { path: '/kpis', label: 'เป้าหมาย KPI', icon: <HiChartBar /> },
  { path: '/tasks', label: 'จัดการงาน', icon: <HiClipboardDocumentList /> },
  { path: '/calendar', label: 'ปฏิทินงาน', icon: <HiCalendarDays /> },
  { path: '/meetings', label: 'บันทึกประชุม', icon: <HiDocumentText /> },
  { path: '/ideas', label: 'โน๊ตไอเดียงาน', icon: <HiLightBulb /> },
  { path: '/reports', label: 'รายงาน', icon: <HiChartPie /> },
  { path: '/team', label: 'ทีมงาน', icon: <HiUserGroup /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Read from localStorage on mount
    const adminStatus = localStorage.getItem('isAdmin') === 'true';
    setIsAdmin(adminStatus);
  }, []);

  const handleLockClick = () => {
    if (isAdmin) {
      if (confirm('ต้องการออกจากโหมดผู้ดูแลระบบหรือไม่?')) {
        localStorage.removeItem('isAdmin');
        setIsAdmin(false);
        // Force reload to apply access restrictions
        window.location.reload();
      }
    } else {
      const pin = prompt('กรุณาใส่รหัสผ่านลับ (PIN) เพื่อเข้าถึงเมนูผู้ดูแล:');
      if (pin === '8888') {
        localStorage.setItem('isAdmin', 'true');
        setIsAdmin(true);
        alert('ปลดล็อคสำเร็จ!');
      } else if (pin !== null) {
        alert('รหัสผ่านไม่ถูกต้อง');
      }
    }
  };

  const visibleLinks = navLinks.filter(link => {
    if (link.path === '/team' && !isAdmin) {
      return false;
    }
    return true;
  });

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
          <div className="sidebar-logo-img" style={{ position: 'relative', flexShrink: 0, borderRadius: '6px', overflow: 'hidden' }}>
            {/* Use standard img to avoid Next.js aggressive caching for the overwritten icon, or add query string */}
            <img src="/icon.png?v=3" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <h2>Online Marketing</h2>
            <p>ระบบติดตามทีม GFS&amp;MHL</p>
          </div>
        </div>
        <button 
          className="toggle-sidebar-btn" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "แสดงเมนู" : "ซ่อนเมนู"}
        >
          {isCollapsed ? <HiChevronRight style={{ margin: 0, fontSize: '1rem' }} /> : <HiChevronLeft style={{ margin: 0, fontSize: '1rem' }} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {visibleLinks.map((link) => (
          <Link
            key={link.path}
            href={link.path}
            className={`sidebar-link${pathname === link.path ? ' active' : ''}`}
          >
            {link.icon}
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>

      <div className={`sidebar-footer ${isCollapsed ? 'collapsed' : ''}`}>
        {!isCollapsed && <small>© 2026 Marketing Team</small>}
        <button 
          onClick={handleLockClick}
          className={`lock-btn ${isAdmin ? 'admin' : ''}`}
          title={isAdmin ? "ล็อคระบบ" : "ปลดล็อคระบบ"}
          onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}
        >
          {isAdmin ? <HiLockOpen size={14} /> : <HiLockClosed size={14} />}
        </button>
      </div>
    </aside>
  );
}
