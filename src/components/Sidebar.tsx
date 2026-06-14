'use client';

import { useState } from 'react';
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
  HiCalendarDays
} from 'react-icons/hi2';

const navLinks = [
  { path: '/', label: 'แดชบอร์ด', icon: <HiChartBarSquare /> },
  { path: '/tasks', label: 'จัดการงาน', icon: <HiClipboardDocumentList /> },
  { path: '/calendar', label: 'ปฏิทินงาน', icon: <HiCalendarDays /> },
  { path: '/kpis', label: 'เป้าหมาย KPI', icon: <HiChartBar /> },
  { path: '/team', label: 'ทีมงาน', icon: <HiUserGroup /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
          <div className="sidebar-logo-img" style={{ position: 'relative', flexShrink: 0, borderRadius: '6px', overflow: 'hidden' }}>
            {/* Use standard img to avoid Next.js aggressive caching for the overwritten icon, or add query string */}
            <img src="/icon.png?v=2" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
        {navLinks.map((link) => (
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

      <div className="sidebar-footer">
        <small>© 2026 Marketing Team</small>
      </div>
    </aside>
  );
}
