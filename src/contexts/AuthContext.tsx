'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  currentUserId: string | null;
  login: (userId: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUserId: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check local storage for saved user ID
    const savedUserId = localStorage.getItem('mkt_team_user_id');
    if (savedUserId) {
      setCurrentUserId(savedUserId);
    } else if (pathname !== '/login') {
      // Redirect to login if no user is found and not already on login page
      router.push('/login');
    }
    setIsLoading(false);
  }, [pathname, router]);

  const login = (userId: string) => {
    localStorage.setItem('mkt_team_user_id', userId);
    setCurrentUserId(userId);
    router.push('/');
  };

  const logout = () => {
    localStorage.removeItem('mkt_team_user_id');
    setCurrentUserId(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ currentUserId, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
