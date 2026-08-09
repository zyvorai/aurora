'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getNavGroups, type NavGroup, type NavItem } from '@/lib/nav-data';
import type { AppRole } from '@/lib/role-routing';
import { useDesktop } from './DesktopContext';
import { cn } from '@/lib/cn';

function sectionKey(groupId: string): string {
  return `desktop_sidebar_section_${groupId}`;
}

interface DesktopSidebarProps {
  hasProduct: boolean;
  role: AppRole | null;
  productId: string;
  productName?: string;
}

export function DesktopSidebar({ hasProduct, role, productId, productName }: DesktopSidebarProps) {
  const { sidebarCollapsed, toggleSidebarCollapsed } = useDesktop();
  const pathname = usePathname();
  const router = useRouter();
  const groups = getNavGroups(hasProduct, role);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    groups.forEach((g) => {
      if (g.collapsible) initial[g.id] = localStorage.getItem(sectionKey(g.id)) === '1';
    });
    setCollapsedSections(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProduct, role]);

  function isActive(item: NavItem): boolean {
    const href = item.href(productId);
    if (href === '/dashboard') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function hasActiveItem(group: NavGroup): boolean {
    return group.items.some(isActive);
  }

  function handleToggleSection(groupId: string) {
    setCollapsedSections((prev) => {
      const next = !prev[groupId];
      localStorage.setItem(sectionKey(groupId), next ? '1' : '0');
      return { ...prev, [groupId]: next };
    });
  }

  return (
    <aside
      className={cn(
        'mac-finder-sidebar tahoe-sidebar-expanded glass glass-elevated hidden lg:flex flex-col shrink-0 border-r border-[var(--glass-border)] transition-[width] duration-200',
        sidebarCollapsed ? 'w-[56px]' : 'w-[220px]',
      )}
    >
      {!sidebarCollapsed && (
        <div className="px-4 pt-4 pb-2">
          <div className="text-eyebrow text-[10px] text-muted">Desktop</div>
          <div className="text-body font-semibold truncate">{productName || 'Emissary'}</div>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1" aria-label="Main navigation">
        {groups.map((group) => {
          const collapsed = Boolean(group.collapsible && collapsedSections[group.id] && !hasActiveItem(group));
          return (
            <div key={group.id}>
              {group.collapsible && !sidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => handleToggleSection(group.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-muted uppercase tracking-wide hover:text-foreground transition-colors focus-ring rounded-md"
                >
                  {group.label}
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', collapsed && '-rotate-90')} aria-hidden />
                </button>
              )}
              {!collapsed && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => router.push(item.href(productId))}
                        aria-current={active ? 'page' : undefined}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 text-body-sm font-medium transition-[color,background-color,transform] focus-ring',
                          sidebarCollapsed ? 'justify-center rounded-xl' : 'rounded-full',
                          active
                            ? 'bg-[rgba(56,189,248,0.14)] text-[rgb(186,230,253)] shadow-[inset_0_0_0_1px_rgba(56,189,248,0.22),0_2px_12px_-4px_rgba(14,165,233,0.35)]'
                            : 'text-muted hover:text-foreground hover:bg-[var(--glass-bg)]',
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" aria-hidden />
                        {!sidebarCollapsed && item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="p-2 border-t border-[var(--glass-border)]">
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full text-body-sm text-muted hover:text-foreground hover:bg-[var(--glass-bg)] transition-colors focus-ring"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" aria-hidden />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" aria-hidden /> Collapse
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
