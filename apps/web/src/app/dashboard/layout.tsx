'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { products } from '@/lib/api';
import { defaultProductRoute } from '@/lib/role-routing';
import { AppHeader, AppFooter } from '@/components/layout/AppHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { ready, role, signOut } = useAuth();
  const [personaHref, setPersonaHref] = useState<string | undefined>();

  useEffect(() => {
    if (!role) return;
    products.list()
      .then((list) => {
        if (list.length > 0) {
          setPersonaHref(defaultProductRoute(list[0].id, role));
        }
      })
      .catch(() => {});
  }, [role]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to content
      </a>
      <AppHeader onSignOut={signOut} role={role} personaHref={personaHref} />
      <main id="main-content" className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}
