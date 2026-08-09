'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { getDockItems } from '@/lib/nav-data';
import type { AppRole } from '@/lib/role-routing';
import { cn } from '@/lib/cn';

interface DesktopDockProps {
  hasProduct: boolean;
  role: AppRole | null;
  productId: string;
  onOpenPalette: () => void;
}

/** Portaled to document.body so it always floats above page content regardless of any
 * parent's overflow/stacking context -- matches hyper2kvm's actual implementation. */
export function DesktopDock({ hasProduct, role, productId, onOpenPalette }: DesktopDockProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pathname = usePathname();
  const router = useRouter();
  const items = getDockItems(hasProduct, role);

  if (!mounted) return null;

  const dock = (
    <div className="mac-dock">
      <div className="mac-dock-inner">
        <div className="mac-dock-inner-scroll flex items-center gap-1.5">
          {items.map((item) => {
            const href = item.href(productId);
            const active = href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(href)}
                className={cn('mac-dock-item', active && 'mac-dock-item-active')}
                aria-label={item.label}
              >
                <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                <span className="mac-dock-tooltip">{item.label}</span>
                {active ? <span className="mac-dock-dot" aria-hidden /> : null}
              </button>
            );
          })}
          <div className="mac-dock-divider" aria-hidden />
          <button type="button" onClick={onOpenPalette} className="mac-dock-spotlight" aria-label="Command palette">
            <Search className="h-4 w-4" aria-hidden />
            <span className="hidden xl:inline">Search</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dock, document.body);
}
