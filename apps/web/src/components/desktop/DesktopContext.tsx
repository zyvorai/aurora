'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const SIDEBAR_COLLAPSED_KEY = 'desktop_sidebar_collapsed';

interface DesktopContextValue {
  sidebarVisible: boolean;
  toggleSidebarVisible: () => void;
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
}

const DesktopContext = createContext<DesktopContextValue | null>(null);

export function DesktopProvider({ children }: { children: ReactNode }) {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);

  useEffect(() => {
    setSidebarCollapsedState(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  }, []);

  const toggleSidebarVisible = useCallback(() => setSidebarVisible((v) => !v), []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return (
    <DesktopContext.Provider value={{ sidebarVisible, toggleSidebarVisible, sidebarCollapsed, toggleSidebarCollapsed }}>
      {children}
    </DesktopContext.Provider>
  );
}

export function useDesktop(): DesktopContextValue {
  const ctx = useContext(DesktopContext);
  if (!ctx) throw new Error('useDesktop must be used within DesktopProvider');
  return ctx;
}
