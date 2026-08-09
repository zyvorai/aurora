'use client';

import type { ReactNode } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { ClassicShell } from '@/components/desktop/ClassicShell';

/** Picks the macOS desktop shell or the conventional classic shell based on the
 * designStyle theme axis -- mirrors hyper2kvm's AppShell picking DesktopLayout vs
 * ClassicLayout. Single mounting point for every internal-employee page. */
export function AppShell({ children }: { children: ReactNode }) {
  const { designStyle } = useTheme();
  const Shell = designStyle === 'classic' ? ClassicShell : DesktopShell;
  return <Shell>{children}</Shell>;
}
