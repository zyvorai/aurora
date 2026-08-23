import { useEffect, useState } from 'react';

/**
 * Keeps a component mounted for `durationMs` after `open` flips to false, so it can
 * play a CSS exit animation (e.g. .animate-glass-out) instead of vanishing instantly.
 * Pairs with Modal/CommandPalette/ToastContainer/AppShell's account dropdown, which
 * previously all did `if (!open) return null` with zero exit transition.
 *
 * Usage: const rendered = useDelayedUnmount(open, 150);
 *        if (!rendered) return null;
 *        <div className={open ? 'animate-glass-in' : 'animate-glass-out'}>
 */
export function useDelayedUnmount(open: boolean, durationMs: number): boolean {
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    if (!rendered) return;
    const timer = setTimeout(() => setRendered(false), durationMs);
    return () => clearTimeout(timer);
  }, [open, durationMs, rendered]);

  return rendered;
}
