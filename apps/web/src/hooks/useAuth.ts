'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuthSession, readStoredRole, type AppRole } from '@/lib/role-routing';

interface UseAuthOptions {
  redirectTo?: string;
  requireAuth?: boolean;
}

export function useAuth(options: UseAuthOptions = {}) {
  const { redirectTo = '/', requireAuth = true } = options;
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (requireAuth && !t) {
      router.push(redirectTo);
      return;
    }
    setToken(t);
    setRole(readStoredRole());
    setReady(true);
  }, [requireAuth, redirectTo, router]);

  function signOut() {
    clearAuthSession();
    router.push('/');
  }

  return { ready, token, role, signOut };
}
