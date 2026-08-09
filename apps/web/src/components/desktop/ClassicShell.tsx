'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu as MenuIcon, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/context/ProductContext';
import { useTheme } from '@/context/ThemeContext';
import { getNavGroups } from '@/lib/nav-data';
import { cn } from '@/lib/cn';

/** Conventional sticky-navbar fallback shell -- selected when designStyle === 'classic'
 * (mirrors hyper2kvm's ClassicLayout.tsx, its non-mac alternative to the desktop
 * shell). Same nav-data model as DesktopShell, just rendered as a flat top nav
 * instead of menubar+dock+Finder-sidebar+Mission Control. */
export function ClassicShell({ children }: { children: ReactNode }) {
  const { role, signOut } = useAuth({ requireAuth: false });
  const { productId, product } = useProduct();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasProduct = Boolean(productId);
  const items = getNavGroups(hasProduct, role).flatMap((g) => g.items);

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--glass-border)] bg-[var(--glass-bg-elevated)] backdrop-blur-[var(--blur-liquid)]">
        <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden text-muted hover:text-foreground transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
            <Link href="/dashboard" className="flex flex-col min-w-0 focus-ring rounded-sm">
              <span className="text-eyebrow text-[10px]">Emissary</span>
              <span className="text-body font-semibold truncate">{product?.name || 'Dashboard'}</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {items.map((item) => {
              const href = item.href(productId);
              return (
                <Link
                  key={item.id}
                  href={href}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-body-sm font-medium transition-colors focus-ring',
                    isActive(href) ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground hover:bg-[var(--glass-bg)]',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2 rounded-md text-muted hover:text-foreground transition-colors focus-ring"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className="p-2 rounded-md text-muted hover:text-foreground transition-colors focus-ring"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden border-t border-[var(--glass-border)] px-4 py-3 space-y-1" aria-label="Main navigation">
            {items.map((item) => {
              const href = item.href(productId);
              return (
                <Link
                  key={item.id}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'block px-3 py-2 rounded-md text-body-sm transition-colors',
                    isActive(href) ? 'text-foreground bg-[var(--glass-bg)]' : 'text-muted hover:text-foreground hover:bg-[var(--glass-bg)]',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      <main id="main-content" className="flex-1 max-w-content w-full mx-auto px-4 md:px-6 py-6 md:py-8">{children}</main>
    </div>
  );
}
