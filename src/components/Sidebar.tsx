'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HiChartBarSquare,
  HiClipboardDocumentList,
  HiChartBar,
  HiDocumentText,
  HiUserGroup,
  HiMegaphone,
  HiChevronLeft,
  HiChevronRight
} from 'react-icons/hi2';

const navLinks = [
  { path: '/', label: 'แดชบอร์ด', icon: <HiChartBarSquare /> },
  { path: '/tasks', label: 'จัดการงาน', icon: <HiClipboardDocumentList /> },
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
          <HiMegaphone style={{ flexShrink: 0 }} />
          <div>
            <h2>TeamTracker</h2>
            <p>ระบบติดตามทีม</p>
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
