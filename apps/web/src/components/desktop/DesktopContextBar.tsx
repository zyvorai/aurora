'use client';

import { usePathname, useRouter } from 'next/navigation';
import { getNavGroups } from '@/lib/nav-data';
import type { AppRole } from '@/lib/role-routing';
import { cn } from '@/lib/cn';

interface DesktopContextBarProps {
  hasProduct: boolean;
  role: AppRole | null;
  productId: string;
}

/** Pill sub-nav shown only when the active nav group has more than one item -- the new
 * home for the product persona tabs (Brief/Sales/Pipeline/Marketing/Partner/Forge)
 * that used to live in the old SidebarNav. */
export function DesktopContextBar({ hasProduct, role, productId }: DesktopContextBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  if (!hasProduct) return null;
  const workspace = getNavGroups(hasProduct, role).find((g) => g.id === 'workspace');
  if (!workspace || workspace.items.length <= 1) return null;

  return (
    <div className="tahoe-context-bar relative z-30 flex items-center gap-1 px-3 lg:px-4 py-1.5 overflow-x-auto border-b border-[var(--glass-border)]">
      {workspace.items.map((item) => {
        const href = item.href(productId);
        const active = pathname === href || (href !== `/products/${productId}` && pathname.startsWith(`${href}/`)) || pathname === href;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => router.push(href)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-body-sm font-medium whitespace-nowrap transition-colors focus-ring',
              active ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground hover:bg-[var(--glass-bg)]',
            )}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
