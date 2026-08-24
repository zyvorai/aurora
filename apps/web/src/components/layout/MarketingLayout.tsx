'use client';

import type { ReactNode } from 'react';
import { GlobalNav } from '@/components/layout/GlobalNav/GlobalNav';
import { SiteFooter } from '@/components/layout/SiteFooter';

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-theme min-h-screen flex flex-col">
      <GlobalNav variant="marketing" />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
