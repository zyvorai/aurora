'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getNavGroups } from '@/lib/nav-data';
import type { AppRole } from '@/lib/role-routing';
import { cn } from '@/lib/cn';

interface DesktopMenubarProps {
  hasProduct: boolean;
  role: AppRole | null;
  productId: string;
  onOpenPalette: () => void;
  onOpenMissionControl: () => void;
  onOpenHelp: () => void;
}

interface MenuDef {
  key: string;
  label: string;
  isAppMenu?: boolean;
  items: { label: string; shortcut?: string; onSelect: () => void }[];
}

export function DesktopMenubar({ hasProduct, role, productId, onOpenPalette, onOpenMissionControl, onOpenHelp }: DesktopMenubarProps) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const groups = getNavGroups(hasProduct, role);

  const menus: MenuDef[] = [
    {
      key: 'app',
      label: 'Emissary',
      isAppMenu: true,
      items: [
        { label: 'Dashboard', onSelect: () => router.push('/dashboard') },
        { label: 'Settings', onSelect: () => router.push('/dashboard/settings') },
      ],
    },
    {
      key: 'view',
      label: 'View',
      items: [
        { label: 'Dashboard', onSelect: () => router.push('/dashboard') },
        { label: 'Mission Control', shortcut: 'F3', onSelect: onOpenMissionControl },
        { label: 'Command Palette', shortcut: '⌘K', onSelect: onOpenPalette },
      ],
    },
    ...groups
      .filter((g) => g.id !== 'home')
      .map((g) => ({
        key: g.id,
        label: g.label,
        items: g.items.map((item) => ({
          label: item.label,
          onSelect: () => router.push(item.href(productId)),
        })),
      })),
    {
      key: 'help',
      label: 'Help',
      items: [{ label: 'Keyboard Shortcuts', shortcut: '?', onSelect: onOpenHelp }],
    },
  ];

  return (
    <div ref={menuRef} className="flex items-center gap-0.5 relative z-[400]">
      {menus.map((menu) => (
        <div key={menu.key} className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((cur) => (cur === menu.key ? null : menu.key))}
            className={cn(
              'px-2.5 py-1.5 rounded-md text-body-sm transition-colors focus-ring',
              menu.isAppMenu ? 'font-semibold text-foreground' : 'text-muted hover:text-foreground',
              openMenu === menu.key && 'bg-[var(--glass-bg-elevated)] text-foreground',
            )}
          >
            {menu.label}
          </button>
          {openMenu === menu.key && (
            <div className="absolute top-full left-0 mt-1 min-w-[200px] glass-strong rounded-lg py-1.5 z-[500] shadow-xl">
              {menu.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.onSelect();
                    setOpenMenu(null);
                  }}
                  className="w-full flex items-center justify-between gap-4 px-3 py-1.5 text-body-sm text-left text-muted hover:text-foreground hover:bg-[var(--glass-bg)] transition-colors"
                >
                  <span>{item.label}</span>
                  {item.shortcut && <span className="text-xs text-muted/70">{item.shortcut}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
