'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/context/ProductContext';
import { AppHeader } from './AppHeader';
import { SidebarNav, resolveActive, personaLabel } from './SidebarNav';
import { Breadcrumbs } from './Breadcrumbs';
import { defaultProductRoute } from '@/lib/role-routing';

interface ProductShellProps {
  children: ReactNode;
}

export function ProductShell({ children }: ProductShellProps) {
  const { signOut, role } = useAuth();
  const { product, productId, loading } = useProduct();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const active = resolveActive(pathname, productId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Loading product…
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
      <AppHeader
        productName={product?.name}
        role={role}
        personaHref={defaultProductRoute(productId, role)}
        showMenuButton
        onMenuToggle={() => setMobileOpen((o) => !o)}
        onSignOut={signOut}
      />
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex w-56 shrink-0 border-r border-border bg-surface/30 flex-col">
          <SidebarNav productId={productId} />
        </aside>

        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-surface-elevated border-r border-border md:hidden pt-14">
              <SidebarNav productId={productId} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 md:px-6 py-3 border-b border-border bg-surface/20">
            <Breadcrumbs
              items={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: product?.name ?? 'Product', href: defaultProductRoute(productId, role) },
                { label: personaLabel(active) },
              ]}
            />
          </div>
          <main id="main-content" className="flex-1 max-w-content w-full mx-auto px-4 md:px-6 py-6 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
