'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { useProduct } from '@/context/ProductContext';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { getNavGroups, getFlatNavItems, WORKSPACE_COLORS } from '@/lib/nav-data';
import type { PersonaPath } from '@/lib/role-routing';
import CommandPalette, { type CommandPaletteItem } from '@/components/CommandPalette';
import { cn } from '@/lib/cn';
import { TONE_CLASSES } from '@/lib/tone';
import { useDelayedUnmount } from '@/hooks/useDelayedUnmount';

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, signOut } = useAuth({ requireAuth: false });
  const { theme, toggleTheme } = useTheme();
  const { productId } = useProduct();
  const hasProduct = Boolean(productId);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const accountMenuRendered = useDelayedUnmount(accountOpen, 150);
  const mobileSheetRendered = useDelayedUnmount(mobileOpen, 150);
  // Mirrors hypersdk-web's .gnav[data-open='true'] -- the bar goes more opaque and its
  // hairline border vanishes while any menu/sheet is open.
  const navOpen = accountOpen || mobileOpen;

  useKeyboardShortcut({ key: 'k', ctrlOrMeta: true, handler: () => setPaletteOpen(true) });

  const groups = getNavGroups(hasProduct, role);
  const workspaceGroup = groups.find((g) => g.id === 'workspace');
  const systemGroup = groups.find((g) => g.id === 'system');

  const paletteItems: CommandPaletteItem[] = getFlatNavItems(hasProduct, role).map(({ group, item }) => ({
    id: item.id,
    label: item.label,
    group,
    keywords: item.label,
    icon: item.icon,
    tone: group === 'Workspace' ? WORKSPACE_COLORS[item.id as PersonaPath] : undefined,
    onSelect: () => router.push(item.href(productId)),
  }));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header
        className={cn(
          'sticky top-0 z-40 backdrop-blur-xl backdrop-saturate-[1.8] transition-colors',
          navOpen ? 'bg-[var(--nav-bg-open)] border-b border-transparent' : 'bg-[var(--nav-bg)] border-b border-[var(--nav-border)]',
        )}
      >
        <div className="max-w-content mx-auto px-6 h-11 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
              <div className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] bg-accent-blue text-white font-black text-xs shadow-md transition-transform group-hover:scale-105">
                A
              </div>
              <span className="font-black tracking-tight text-sm hidden sm:inline">AURORA</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/dashboard"
                className={cn(
                  'text-sm font-medium rounded-[var(--radius-sm)] px-[11px] py-2 transition-colors hover:bg-[var(--nav-hover-bg)]',
                  pathname === '/dashboard' ? 'text-foreground' : 'text-muted',
                )}
              >
                Dashboard
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] text-sm text-muted hover:text-foreground hover:bg-[var(--nav-hover-bg)] transition-colors focus-ring"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline font-mono text-[0.7rem] opacity-60">⌘K</kbd>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="w-[30px] h-[30px] flex items-center justify-center rounded-[var(--radius-sm)] text-muted hover:text-foreground hover:bg-[var(--nav-hover-bg)] transition-colors focus-ring"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--radius-sm)] text-muted hover:text-foreground hover:bg-[var(--nav-hover-bg)] transition-colors focus-ring"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
              >
                <div className="w-6 h-6 flex items-center justify-center rounded-full bg-surface text-xs font-semibold uppercase">
                  {role?.[0] ?? 'U'}
                </div>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {accountMenuRendered && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                  <div
                    role="menu"
                    className={cn(
                      'absolute right-0 top-full mt-2 w-56 border border-border bg-surface shadow-lg z-50 py-1',
                      accountOpen ? 'animate-glass-in' : 'animate-glass-out',
                    )}
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

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              className="md:hidden w-[30px] h-[30px] flex items-center justify-center rounded-[var(--radius-sm)] text-muted hover:text-foreground hover:bg-[var(--nav-hover-bg)] transition-colors focus-ring"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {hasProduct && workspaceGroup && workspaceGroup.items.length > 0 && (
          <div className="hidden md:block border-t border-[var(--nav-border)]">
            <div className="max-w-content mx-auto px-6 flex items-center gap-1 overflow-x-auto">
              {workspaceGroup.items.map((item) => {
                const href = item.href(productId);
                const active = pathname === href;
                const tone = TONE_CLASSES[WORKSPACE_COLORS[item.id as PersonaPath]];
                return (
                  <Link
                    key={item.id}
                    href={href}
                    className={cn(
                      'px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                      active
                        ? cn(tone.border, 'text-foreground')
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

      {/* Rendered as a sibling of <header>, not a child -- <header> has backdrop-blur
          (a CSS backdrop-filter), which creates a new containing block for `position:
          fixed` descendants per spec. A fixed sheet nested inside it resolves `top`/
          `bottom` against the header's own (44px-tall) box instead of the viewport,
          collapsing its height instead of covering the screen. */}
      {mobileSheetRendered && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
          <div
            className={cn(
              'md:hidden fixed inset-x-0 top-11 bottom-0 z-40 overflow-y-auto',
              'bg-[var(--nav-bg-open)] backdrop-blur-xl px-6 py-4 space-y-1',
              mobileOpen ? 'animate-fade-in' : 'animate-fade-out',
            )}
          >
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 rounded-[var(--radius-sm)] text-sm font-medium text-foreground hover:bg-[var(--nav-hover-bg)]"
            >
              Dashboard
            </Link>

            {hasProduct && workspaceGroup && workspaceGroup.items.length > 0 && (
              <>
                <div className="my-2 border-t border-[var(--nav-border)]" />
                {workspaceGroup.items.map((item) => {
                  const href = item.href(productId);
                  const tone = TONE_CLASSES[WORKSPACE_COLORS[item.id as PersonaPath]];
                  return (
                    <Link
                      key={item.id}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'block px-3 py-2.5 rounded-[var(--radius-sm)] text-sm font-medium hover:bg-[var(--nav-hover-bg)]',
                        pathname === href ? tone.text : 'text-muted',
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </>
            )}

            <div className="my-2 border-t border-[var(--nav-border)]" />
            {systemGroup?.items.map((item) => (
              <Link
                key={item.id}
                href={item.href(productId)}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-foreground hover:bg-[var(--nav-hover-bg)]"
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                signOut();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-danger hover:bg-[var(--nav-hover-bg)] text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </>
      )}

      <main className="flex-1">{children}</main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
    </div>
  );
}
