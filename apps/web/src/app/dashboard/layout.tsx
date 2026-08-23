'use client';

import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { SkeletonLine } from '@/components/ui/Skeleton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SkeletonLine className="w-40 h-4" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
