'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
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
  HiArrowRightOnRectangle,
  HiEllipsisVertical,
  HiLockClosed,
  HiLockOpen,
  HiChartPie,
  HiLightBulb,
  HiUserCircle
} from 'react-icons/hi2';

interface Member {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
}

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

  const { currentUserId, logout } = useAuth();
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    if (currentUserId) {
      fetch('/api/members')
        .then(res => res.json())
        .then((data: Member[]) => {
          const user = data.find(m => m.id === currentUserId);
          if (user) {
            setCurrentUser(user);
            if (user.role === 'Admin') {
              setIsAdmin(true);
            }
          }
        });
    }
  }, [currentUserId]);

  const handleLogout = () => {
    logout();
  };

  const visibleLinks = navLinks.filter(link => {
    if (link.path === '/team' && !isAdmin) {
      return false;
    }
    return true;
  });

  if (pathname === '/login') {
    return null;
  }

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

      <div className={`sidebar-footer ${isCollapsed ? 'collapsed' : ''}`} style={{ padding: '1rem', borderTop: '1px solid #f1f5f9', position: 'relative' }}>
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', cursor: 'pointer' }} onClick={() => setShowUserMenu(!showUserMenu)}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <HiUserCircle size={36} color="#94a3b8" />
              )}
            </div>
            {!isCollapsed && (
              <>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{currentUser.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{currentUser.role}</div>
                </div>
                <HiEllipsisVertical size={20} color="#64748b" />
              </>
            )}
          </div>
        ) : (
          !isCollapsed && <small>© 2026 Marketing Team</small>
        )}
        
        {showUserMenu && !isCollapsed && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '1rem',
            right: '1rem',
            marginBottom: '0.5rem',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            zIndex: 50
          }}>
            <button 
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.75rem 1rem',
                border: 'none',
                background: 'none',
                color: '#ef4444',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <HiArrowRightOnRectangle size={18} />
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
