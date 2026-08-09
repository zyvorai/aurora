'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/context/ProductContext';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useTheme } from '@/context/ThemeContext';
import CommandPalette, { type CommandPaletteItem } from '@/components/CommandPalette';
import { getFlatNavItems } from '@/lib/nav-data';
import { DesktopProvider, useDesktop } from './DesktopContext';
import { DesktopMenubar } from './DesktopMenubar';
import { DesktopStatusIsland } from './DesktopStatusIsland';
import { DesktopControlCenter } from './DesktopControlCenter';
import { DesktopContextBar } from './DesktopContextBar';
import { DesktopMobileJumpNav } from './DesktopMobileJumpNav';
import { DesktopSidebar } from './DesktopSidebar';
import { DesktopDock } from './DesktopDock';
import { MissionControlProvider, useMissionControl, dispatchOpenMissionControl } from './MissionControlContext';
import { MissionControlOverlay } from './MissionControlOverlay';
import { HelpDialog } from './HelpDialog';

const SHELL_BG: Record<string, string> = {
  dark: 'dashboard-liquid-glass',
  steel: 'dashboard-steel',
  aurora: 'dashboard-aurora',
};

function ShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { role, signOut } = useAuth({ requireAuth: false });
  const { productId, product } = useProduct();
  const { colorVariant } = useTheme();
  const { sidebarVisible } = useDesktop();
  const { openMissionControl } = useMissionControl();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const hasProduct = Boolean(productId);

  useKeyboardShortcut({ key: 'k', ctrlOrMeta: true, handler: () => setPaletteOpen(true) });
  useKeyboardShortcut({ key: 'F3', handler: dispatchOpenMissionControl });
  useKeyboardShortcut({ key: '?', handler: () => setHelpOpen(true) });

  const paletteItems = useMemo<CommandPaletteItem[]>(() => {
    const navItems = getFlatNavItems(hasProduct, role).map(({ group, item }): CommandPaletteItem => ({
      id: item.id,
      label: item.label,
      group,
      onSelect: () => router.push(item.href(productId)),
    }));
    return navItems.concat([
      { id: 'mission-control', label: 'Mission Control', group: 'Actions', onSelect: openMissionControl },
      { id: 'sign-out', label: 'Sign out', group: 'Actions', onSelect: signOut },
    ]);
  }, [hasProduct, role, productId, router, openMissionControl, signOut]);

  return (
    <div className={`mac-desktop-root ${SHELL_BG[colorVariant === 'default' ? 'dark' : colorVariant] ?? SHELL_BG.dark} flex flex-col flex-1 min-h-screen overflow-x-hidden`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[600] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to content
      </a>
      <header className="mac-menubar-inner glass shrink-0 relative z-40 flex items-center gap-2 px-2 lg:px-3 h-11 overflow-visible">
        <DesktopMenubar
          hasProduct={hasProduct}
          role={role}
          productId={productId}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenMissionControl={openMissionControl}
          onOpenHelp={() => setHelpOpen(true)}
        />
        <div className="flex-1 flex justify-center pointer-events-none">
          <DesktopStatusIsland />
        </div>
        <div className="ml-auto pointer-events-auto">
          <DesktopControlCenter />
        </div>
      </header>

      <DesktopContextBar hasProduct={hasProduct} role={role} productId={productId} />
      <DesktopMobileJumpNav hasProduct={hasProduct} role={role} productId={productId} />

      <div className="flex flex-1 min-h-0">
        {sidebarVisible ? (
          <DesktopSidebar hasProduct={hasProduct} role={role} productId={productId} productName={product?.name} />
        ) : null}
        <div className="tahoe-canvas mac-desktop-main flex-1 min-w-0 flex flex-col relative">
          <div className="tahoe-mesh pointer-events-none" aria-hidden />
          <div className="relative z-[1] flex flex-col flex-1 min-h-0 px-4 lg:px-6 pt-4 pb-16 lg:pb-20 max-w-[100rem] mx-auto w-full">
            <div id="main-content" className="flex-1 min-h-0 overflow-y-auto py-3 pb-6">{children}</div>
          </div>
        </div>
      </div>

      <DesktopDock hasProduct={hasProduct} role={role} productId={productId} onOpenPalette={() => setPaletteOpen(true)} />
      <MissionControlOverlay hasProduct={hasProduct} role={role} productId={productId} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} title="Jump to a workspace…" />
    </div>
  );
}

export function DesktopShell({ children }: { children: ReactNode }) {
  return (
    <DesktopProvider>
      <MissionControlProvider>
        <ShellInner>{children}</ShellInner>
      </MissionControlProvider>
    </DesktopProvider>
  );
}
