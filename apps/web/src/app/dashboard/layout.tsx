'use client';

import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
