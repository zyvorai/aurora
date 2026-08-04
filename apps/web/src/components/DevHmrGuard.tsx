'use client';

import { useEffect, useState } from 'react';

/** Shows banner when inline head script detects dev server / HMR is gone. */
export default function DevHmrGuard() {
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    const onStopped = () => setStopped(true);
    window.addEventListener('gtm:dev-server-stopped', onStopped);
    return () => window.removeEventListener('gtm:dev-server-stopped', onStopped);
  }, []);

  if (!stopped) return null;

  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-[100] bg-amber-500/95 text-black text-sm text-center py-2 px-4 shadow-md"
    >
      Dev server stopped — close this tab (Cmd+W) or run <code className="font-mono">make start</code> and open a fresh tab.
    </div>
  );
}
