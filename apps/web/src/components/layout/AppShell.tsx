'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Moon, Search, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { useProduct } from '@/context/ProductContext';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { getNavGroups, getFlatNavItems } from '@/lib/nav-data';
import CommandPalette, { type CommandPaletteItem } from '@/components/CommandPalette';
import { cn } from '@/lib/cn';

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, signOut } = useAuth({ requireAuth: false });
  const { theme, toggleTheme } = useTheme();
  const { productId } = useProduct();
  const hasProduct = Boolean(productId);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useKeyboardShortcut({ key: 'k', ctrlOrMeta: true, handler: () => setPaletteOpen(true) });

  const groups = getNavGroups(hasProduct, role);
  const workspaceGroup = groups.find((g) => g.id === 'workspace');
  const systemGroup = groups.find((g) => g.id === 'system');

  const paletteItems: CommandPaletteItem[] = getFlatNavItems(hasProduct, role).map(({ group, item }) => ({
    id: item.id,
    label: item.label,
    group,
    keywords: item.label,
    onSelect: () => router.push(item.href(productId)),
  }));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-content mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 flex items-center justify-center bg-foreground text-background font-black text-sm">
                E
              </div>
              <span className="font-black tracking-tight hidden sm:inline">EMISSARY</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/dashboard"
                className={cn(
                  'text-sm font-medium transition-opacity hover:opacity-70',
                  pathname === '/dashboard' ? 'text-foreground' : 'text-muted',
                )}
              >
                Dashboard
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 border border-border text-sm text-muted hover:text-foreground hover:border-[var(--glass-border-strong)] transition-colors focus-ring"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline font-mono text-[0.7rem] opacity-60">⌘K</kbd>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 text-muted hover:text-foreground transition-colors focus-ring"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-muted hover:text-foreground transition-colors focus-ring"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
              >
                <div className="w-6 h-6 flex items-center justify-center rounded-full bg-surface text-xs font-semibold uppercase">
                  {role?.[0] ?? 'U'}
                </div>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {accountOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-56 border border-border bg-surface shadow-lg z-50 py-1"
                  >
                    {systemGroup?.items.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href(productId)}
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-2 text-sm text-foreground hover:bg-background transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div className="my-1 border-t border-border" />
                    <button
                      type="button"
                      onClick={signOut}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-background transition-colors text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {hasProduct && workspaceGroup && workspaceGroup.items.length > 0 && (
          <div className="border-t border-border">
            <div className="max-w-content mx-auto px-6 flex items-center gap-1 overflow-x-auto">
              {workspaceGroup.items.map((item) => {
                const href = item.href(productId);
                const active = pathname === href;
                return (
                  <Link
                    key={item.id}
                    href={href}
                    className={cn(
                      'px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                      active
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
    </div>
  );
}
