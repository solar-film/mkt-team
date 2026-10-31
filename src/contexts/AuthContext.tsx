'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

type LoginResult = { ok: true } | { ok: false; error: string };

interface AuthContextType {
  currentUserId: string | null;
  login: (memberId: string, pin: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUserId: null,
  login: async () => ({ ok: false, error: '' }),
  logout: async () => {},
  isLoading: true,
});

// Pages reachable without a member session (the admin page has its own password).
const OPEN_PAGES = ['/login', '/admin'];

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const openPage = OPEN_PAGES.includes(pathname);

  useEffect(() => {
    // Identity now lives in an HttpOnly cookie; drop the old self-declared profile choice.
    try { localStorage.removeItem('mkt_team_user_id'); } catch { /* storage may be blocked */ }
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .catch(() => null)
      .then(data => {
        if (cancelled) return;
        setCurrentUserId(data?.memberId ?? null);
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isLoading && !currentUserId && !openPage) router.replace('/login');
  }, [isLoading, currentUserId, openPage, router]);

  const login = useCallback(async (memberId: string, pin: string): Promise<LoginResult> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || 'เข้าสู่ระบบไม่สำเร็จ' };
      setCurrentUserId(data.memberId);
      router.push('/');
      return { ok: true };
    } catch {
      return { ok: false, error: 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง' };
    }
  }, [router]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    setCurrentUserId(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ currentUserId, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
