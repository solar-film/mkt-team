'use client';
import { fetchWorkspace } from '@/lib/workspace-fetch';

import { Fragment, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { externalLinkProps } from '@/lib/external-link';
import { CONTENT_STATS_ENABLED } from '@/lib/stats-due';
import AccountMenuItems from '@/components/AccountMenuItems';
import {
  HiChartBarSquare,
  HiClipboardDocumentList,
  HiChartBar,
  HiDocumentText,
  HiUserGroup,
  HiChatBubbleLeftRight,
  HiVideoCamera,
  HiMegaphone,
  HiGlobeAlt,
  HiChevronLeft,
  HiChevronRight,
  HiChevronDown,
  HiCalendarDays,
  HiArrowRightOnRectangle,
  HiEllipsisVertical,
  HiLockClosed,
  HiLockOpen,
  HiChartPie,
  HiLightBulb,
  HiUserCircle,
  HiEllipsisHorizontal,
  HiBuildingOffice2,
  HiBanknotes,
  HiPresentationChartLine,
  HiCircleStack
} from 'react-icons/hi2';
import { SiFacebook, SiGoogleads, SiOpenai } from 'react-icons/si';

interface Member {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
}

// Grouped in menu order; the desktop sidebar shows a foldable heading where the group changes.
// Groups start folded except "จัดการงาน/KPI" and the one holding the current page.
// The mobile bottom bar shows the MOBILE_BAR links and puts the rest under "เพิ่มเติม".
const navLinks = [
  { group: 'ภาพรวม', path: '/', label: 'แดชบอร์ด', icon: <HiChartBarSquare /> },
  { group: 'ภาพรวม', path: '/reports', label: 'รายงาน', icon: <HiChartPie /> },
  { group: 'จัดการงาน/KPI', path: '/calendar', label: 'ปฏิทินงาน', icon: <HiCalendarDays /> },
  { group: 'จัดการงาน/KPI', path: '/tasks', label: 'จัดการงาน', icon: <HiClipboardDocumentList /> },
  { group: 'จัดการงาน/KPI', path: '/ideas', label: 'โน๊ตไอเดีย', icon: <HiLightBulb /> },
  { group: 'จัดการงาน/KPI', path: '/kpis', label: 'เป้าหมาย KPI', icon: <HiChartBar /> },
  { group: 'จัดการงาน/KPI', path: '/content-stats', label: 'สถิติคอนเทนต์', icon: <HiChartPie /> },
  { group: 'ข้อมูลตลาด', path: '/market', label: 'ภาพรวมค่าโฆษณา', icon: <HiBanknotes /> },
  { group: 'ข้อมูลตลาด', path: '/market/google', label: 'Google Ads', icon: <SiGoogleads /> },
  { group: 'ข้อมูลตลาด', path: '/market/facebook', label: 'Facebook Ads', icon: <SiFacebook /> },
  { group: 'ข้อมูลตลาด', path: '/market/chatgpt', label: 'ChatGPT Ads', icon: <SiOpenai /> },
  { group: 'ข้อมูลตลาด', path: '/market/analysis', label: 'วิเคราะห์โฆษณา', icon: <HiPresentationChartLine /> },
  { group: 'ทีม & ธุรกิจ', path: '/meetings', label: 'บันทึกประชุม', icon: <HiDocumentText /> },
  { group: 'ทีม & ธุรกิจ', path: '/company', label: 'โครงสร้างธุรกิจ', icon: <HiBuildingOffice2 /> },
  { group: 'ทีม & ธุรกิจ', path: '/sources', label: 'แหล่งข้อมูล', icon: <HiCircleStack /> },
  { group: 'ทีม & ธุรกิจ', path: '/team', label: 'ทีมงาน', icon: <HiUserGroup /> },
  { group: 'ลิงก์ภายนอก', path: 'https://solar-film.github.io/feedback/admin/', label: 'feedback', icon: <HiChatBubbleLeftRight /> },
  { group: 'ลิงก์ภายนอก', path: 'https://solar-film.github.io/BB/', label: 'BB Meeting', icon: <HiVideoCamera /> },
];
const MOBILE_BAR = new Set(['/', '/reports', '/calendar', '/tasks', '/ideas', '/kpis']);

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const { currentUserId, logout } = useAuth();
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const activeGroup = navLinks.find(link => link.path === pathname)?.group;
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(activeGroup ? ['จัดการงาน/KPI', activeGroup] : ['จัดการงาน/KPI']));

  // Opening another page unfolds its group so the highlighted link stays visible.
  useEffect(() => {
    if (activeGroup) setOpenGroups(prev => (prev.has(activeGroup) ? prev : new Set(prev).add(activeGroup)));
  }, [activeGroup]);

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  useEffect(() => {
    if (currentUserId) {
      if (currentUserId === 'GUEST') {
        setCurrentUser({ id: 'GUEST', name: 'ผู้เยี่ยมชม', role: 'Guest', avatar: null });
        return;
      }
      fetchWorkspace('/api/members')
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
    void logout();
  };

  const updateAvatar = (avatar: string | null) => setCurrentUser(prev => (prev ? { ...prev, avatar } : prev));

  const visibleLinks = navLinks.filter(link => {
    if (link.path === '/team' && !isAdmin) {
      return false;
    }
    if (link.path === '/content-stats' && !CONTENT_STATS_ENABLED) {
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
        {visibleLinks.map((link, index) => (
            <Fragment key={link.path}>
              {link.group !== visibleLinks[index - 1]?.group && (
                <button
                  type="button"
                  className={`sidebar-group-label desktop-only${index === 0 ? ' first' : ''}`}
                  onClick={() => toggleGroup(link.group)}
                  aria-expanded={openGroups.has(link.group)}
                >
                  <span>{link.group}</span>
                  {openGroups.has(link.group) ? <HiChevronDown /> : <HiChevronRight />}
                </button>
              )}
              <Link
                href={link.path}
                {...externalLinkProps(link.path)}
                className={`sidebar-link${pathname === link.path ? ' active' : ''} ${MOBILE_BAR.has(link.path) ? '' : 'desktop-only-flex'}${openGroups.has(link.group) ? '' : ' group-closed'}`}
                title={isCollapsed ? link.label : undefined}
              >
                {link.icon}
                <span>
                  {link.label}
                  {externalLinkProps(link.path).target && <small className="sidebar-external-mark" aria-label="เปิดในแท็บใหม่"> ↗</small>}
                </span>
              </Link>
            </Fragment>
        ))}
        {/* Mobile More Button */}
        {visibleLinks.some(link => !MOBILE_BAR.has(link.path)) && (
          <div className="mobile-only" style={{ position: 'relative' }}>
            <button 
              className={`sidebar-link ${showMobileMore ? 'active' : ''}`} 
              onClick={() => setShowMobileMore(!showMobileMore)}
              style={{ border: 'none', cursor: 'pointer', background: 'transparent', width: '100%', alignItems: 'center' }}
            >
              <HiEllipsisHorizontal />
              <span>เพิ่มเติม</span>
            </button>
            
            {showMobileMore && (
              <>
                <div 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} 
                  onClick={() => setShowMobileMore(false)} 
                />
                <div style={{
                  position: 'fixed',
                  bottom: '70px',
                  right: '10px',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  minWidth: '200px',
                  maxHeight: 'calc(100vh - 100px)',
                  overflowY: 'auto',
                  zIndex: 100,
                  border: '1px solid #e2e8f0'
                }}>
                  {visibleLinks.filter(link => !MOBILE_BAR.has(link.path)).map((link) => (
                    <Link
                      key={link.path}
                      href={link.path}
                      {...externalLinkProps(link.path)}
                      onClick={() => setShowMobileMore(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.75rem 1rem', borderRadius: '10px',
                        textDecoration: 'none', color: pathname === link.path ? '#023a8a' : '#475569',
                        backgroundColor: pathname === link.path ? '#e6edf7' : 'transparent',
                        fontWeight: pathname === link.path ? 600 : 500,
                        fontSize: '0.95rem'
                      }}
                    >
                      {link.icon}
                      {link.label}
                    </Link>
                  ))}
                  <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '0.25rem 0' }} />
                  {currentUser && <AccountMenuItems memberId={currentUser.id} onAvatarChanged={updateAvatar} onDone={() => setShowMobileMore(false)} />}
                  <button
                    onClick={() => { setShowMobileMore(false); handleLogout(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.75rem 1rem', borderRadius: '10px', border: 'none', background: 'transparent',
                      color: '#ef4444', fontWeight: 500, fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    <HiArrowRightOnRectangle size={20} />
                    ออกจากระบบ
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </nav>

      <div className={`sidebar-footer ${isCollapsed ? 'collapsed' : ''}`} style={{ padding: '1rem', position: 'relative' }}>
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', cursor: 'pointer' }} onClick={() => setShowUserMenu(!showUserMenu)}>
            <div className="sidebar-avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <HiUserCircle size={36} color="rgba(255, 255, 255, 0.85)" />
              )}
            </div>
            {!isCollapsed && (
              <>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="sidebar-user-name" style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{currentUser.name}</div>
                  <div className="sidebar-user-role" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{currentUser.role}</div>
                </div>
                <HiEllipsisVertical size={20} color="rgba(255, 255, 255, 0.72)" />
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
            {currentUser && <AccountMenuItems memberId={currentUser.id} onAvatarChanged={updateAvatar} onDone={() => setShowUserMenu(false)} />}
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
