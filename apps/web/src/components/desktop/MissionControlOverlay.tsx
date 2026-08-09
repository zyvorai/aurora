'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getNavGroups } from '@/lib/nav-data';
import type { AppRole } from '@/lib/role-routing';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useMissionControl } from './MissionControlContext';
import { MissionControlZones } from './MissionControlZones';

interface MissionControlOverlayProps {
  hasProduct: boolean;
  role: AppRole | null;
  productId: string;
}

export function MissionControlOverlay({ hasProduct, role, productId }: MissionControlOverlayProps) {
  const { open, closeMissionControl } = useMissionControl();
  const router = useRouter();

  useKeyboardShortcut({ key: 'Escape', handler: closeMissionControl, enabled: open });

  if (!open) return null;

  function handleNavigate(href: string) {
    router.push(href);
    closeMissionControl();
  }

  return (
    <div className="mission-control-overlay">
      <button
        type="button"
        className="mission-control-backdrop"
        aria-label="Close Mission Control"
        onClick={closeMissionControl}
      />
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Mission Control</h2>
            <p className="text-sm text-white/50 mt-1">Jump to any workspace</p>
          </div>
          <button
            type="button"
            onClick={closeMissionControl}
            aria-label="Close Mission Control"
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <MissionControlZones groups={getNavGroups(hasProduct, role)} onNavigate={handleNavigate} productId={productId} />
      </div>
    </div>
  );
}
