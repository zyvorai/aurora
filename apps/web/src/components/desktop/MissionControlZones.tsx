'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { NavGroup } from '@/lib/nav-data';

interface MissionControlZonesProps {
  groups: NavGroup[];
  onNavigate: (href: string) => void;
  productId: string;
}

/** Launchpad-style icon grid grouped by nav section -- not live window previews, this
 * mirrors hyper2kvm's actual Mission Control (a themed app grid, not real window
 * thumbnails). */
export function MissionControlZones({ groups, onNavigate, productId }: MissionControlZonesProps) {
  const pathname = usePathname();

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {groups.map((group) => (
        <div key={group.id} className="mission-control-zone-card">
          <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-3">{group.label}</h3>
          <div className="mission-control-launchpad">
            {group.items.map((item) => {
              const Icon = item.icon;
              const href = item.href(productId);
              const active = href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(href)}
                  className={cn('mission-control-app-icon', active && 'mission-control-app-icon-active')}
                >
                  <span className="mission-control-app-icon-glyph">
                    <Icon className="w-8 h-8" aria-hidden />
                  </span>
                  <span className="mission-control-app-icon-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
