'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/context/ProductContext';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { getNavGroups, getFlatNavItems } from '@/lib/nav-data';
import CommandPalette, { type CommandPaletteItem } from '@/components/CommandPalette';
import { GlobalNav } from '@/components/layout/GlobalNav/GlobalNav';
import styles from '@/components/layout/GlobalNav/GlobalNav.module.css';
import { LicenseBanner } from '@/components/LicenseBanner';
import { cn } from '@/lib/cn';

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, signOut } = useAuth({ requireAuth: false });
  const { productId } = useProduct();
  const hasProduct = Boolean(productId);
  const [paletteOpen, setPaletteOpen] = useState(false);

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
    tone: undefined,
    onSelect: () => router.push(item.href(productId)),
  }));

  const accountItems =
    systemGroup?.items.map((item) => ({
      label: item.label,
      href: item.href(productId),
    })) ?? [];

  const workspaceSubnav =
    hasProduct && workspaceGroup && workspaceGroup.items.length > 0 ? (
      <div className={`hidden md:block ${styles.subnavInner}`}>
        {workspaceGroup.items.map((item) => {
          const href = item.href(productId);
          const active = pathname === href;
          return (
            <Link
              key={item.id}
              href={href}
              className={cn(
                'px-3 py-2.5 text-[13px] font-normal whitespace-nowrap border-b-[1.5px] transition-colors',
                active ? 'border-[var(--accent-blue)] text-foreground' : 'border-transparent text-muted hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    ) : null;

  const appMobileExtra = (
    <>
      {hasProduct && workspaceGroup && workspaceGroup.items.length > 0 ? (
        <>
          <div className={styles.sheetItem}>
            <div className={styles.sheetTop} aria-hidden>
              Workspace
            </div>
            <div className={styles.sheetSub} data-open="true">
              {workspaceGroup.items.map((item) => {
                const href = item.href(productId);
                return (
                  <Link
                    key={item.id}
                    href={href}
                    className={pathname === href ? 'text-primary' : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
      {systemGroup?.items.map((item) => (
        <div key={item.id} className={styles.sheetItem}>
          <Link className={styles.sheetTop} href={item.href(productId)}>
            {item.label}
          </Link>
        </div>
      ))}
      <div className={styles.sheetItem}>
        <button type="button" className={styles.sheetTop} onClick={signOut}>
          <span className="inline-flex items-center gap-2 text-danger">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <LicenseBanner />
      <GlobalNav
        variant="app"
        roleInitial={role?.[0] ?? 'U'}
        accountItems={accountItems}
        onSearchClick={() => setPaletteOpen(true)}
        onSignOut={signOut}
        appMobileExtra={appMobileExtra}
        subnav={workspaceSubnav}
      />

      <main className="flex-1 bg-[var(--app-canvas)]">{children}</main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
    </div>
  );
}
