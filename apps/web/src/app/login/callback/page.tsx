'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { resolvePostLoginRoute, storeAuthSession } from '@/lib/role-routing';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const errorParam = params.get('error');
    if (errorParam) {
      setError(errorParam);
      return;
    }

    const token = params.get('token');
    const tenantId = params.get('tenant_id');
    const role = params.get('role');
    if (!token || !tenantId || !role) {
      setError('Sign-in did not return a valid session. Please try again.');
      return;
    }

    storeAuthSession(token, tenantId, role);
    resolvePostLoginRoute(role).then((destination) => router.replace(destination));
  }, [params, router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 35%, #312e81 55%, #0f172a 100%)' }}
    >
      <div className="login-glass rounded-2xl px-8 py-10 w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-5 border border-white/20">
          <Sparkles className="w-6 h-6 text-white" aria-hidden />
        </div>
        {error ? (
          <>
            <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-3" aria-hidden />
            <p className="text-white/90 text-body-sm mb-5">{error}</p>
            <Link href="/login" className="login-btn-primary inline-flex">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="w-5 h-5 text-white/70 mx-auto mb-3 animate-spin" aria-hidden />
            <p className="text-white/70 text-body-sm">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
