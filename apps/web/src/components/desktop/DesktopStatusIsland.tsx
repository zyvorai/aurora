'use client';

import { useEffect, useState } from 'react';
import { resolveHealthUrl } from '@/lib/api-base';

type HealthState = 'checking' | 'healthy' | 'degraded' | 'unreachable';

export function DesktopStatusIsland() {
  const [state, setState] = useState<HealthState>('checking');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(resolveHealthUrl(), { cache: 'no-store' });
        if (cancelled) return;
        if (!res.ok) {
          setState('unreachable');
          return;
        }
        const body = await res.json();
        setState(body.status === 'healthy' ? 'healthy' : 'degraded');
      } catch {
        if (!cancelled) setState('unreachable');
      }
    }

    check();
    const interval = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const dotColor =
    state === 'healthy' ? 'bg-emerald-400' : state === 'degraded' ? 'bg-amber-400' : state === 'unreachable' ? 'bg-red-400' : 'bg-slate-500';
  const label =
    state === 'healthy' ? 'All systems operational' : state === 'degraded' ? 'Degraded' : state === 'unreachable' ? 'API unreachable' : 'Checking…';

  return (
    <div className="relative pointer-events-auto">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--glass-bg-elevated)] border border-[var(--glass-border)] text-xs text-muted hover:text-foreground transition-colors focus-ring"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden />
        {label}
      </button>
      {expanded && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 glass-strong rounded-lg px-3 py-2 text-xs text-muted whitespace-nowrap z-[500]">
          Emissary API — {label}
        </div>
      )}
    </div>
  );
}
