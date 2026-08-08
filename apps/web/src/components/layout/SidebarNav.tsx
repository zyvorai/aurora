'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Kanban,
  Megaphone,
  Handshake,
  Hammer,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export type PersonaKey = 'brief' | 'sales' | 'pipeline' | 'marketing' | 'partner' | 'forge';

export const NAV_ITEMS: { key: PersonaKey; label: string; href: (id: string) => string; icon: typeof LayoutDashboard }[] = [
  { key: 'brief', label: 'Brief', href: (id) => `/products/${id}/brief`, icon: LayoutDashboard },
  { key: 'sales', label: 'Sales', href: (id) => `/products/${id}/sales`, icon: Users },
  { key: 'pipeline', label: 'Pipeline', href: (id) => `/products/${id}/pipeline`, icon: Kanban },
  { key: 'marketing', label: 'Marketing', href: (id) => `/products/${id}/marketing`, icon: Megaphone },
  { key: 'partner', label: 'Partner', href: (id) => `/products/${id}/partner`, icon: Handshake },
  { key: 'forge', label: 'Full Forge', href: (id) => `/products/${id}`, icon: Hammer },
];

function resolveActive(pathname: string, productId: string): PersonaKey {
  if (pathname === `/products/${productId}`) return 'forge';
  if (pathname.endsWith('/brief')) return 'brief';
  if (pathname.endsWith('/sales')) return 'sales';
  if (pathname.endsWith('/pipeline')) return 'pipeline';
  if (pathname.endsWith('/marketing')) return 'marketing';
  if (pathname.endsWith('/partner')) return 'partner';
  return 'brief';
}

interface SidebarNavProps {
  productId: string;
  onNavigate?: () => void;
  className?: string;
}

export function SidebarNav({ productId, onNavigate, className }: SidebarNavProps) {
  const pathname = usePathname();
  const active = resolveActive(pathname, productId);

  return (
    <nav className={cn('flex flex-col gap-1 p-3', className)} aria-label="Product navigation">
      {NAV_ITEMS.map(({ key, label, href, icon: Icon }) => {
        const isActive = active === key;
        return (
          <Link
            key={key}
            href={href(productId)}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-full px-3 py-2.5 text-body font-medium transition-colors focus-ring',
              isActive
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted hover:text-foreground hover:bg-[var(--glass-bg)]',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function personaLabel(key: PersonaKey): string {
  return NAV_ITEMS.find((n) => n.key === key)?.label ?? key;
}

export { resolveActive };
