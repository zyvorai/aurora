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

    const code = params.get('code');
    if (!code) {
      setError('Sign-in did not return a valid session. Please try again.');
      return;
    }

    import('@/lib/api').then(({ auth }) =>
      auth
        .exchangeOAuthCode(code)
        .then((result) => {
          storeAuthSession(result.access_token, result.tenant_id, result.role);
          return resolvePostLoginRoute(result.role);
        })
        .then((destination) => router.replace(destination))
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
        }),
    );
  }, [params, router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #21414F 0%, #14161A 100%)' }}
    >
      <div className="login-glass rounded-2xl px-8 py-10 w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-[#0A84FF] flex items-center justify-center mx-auto mb-5 border border-white/15">
          <Sparkles className="w-6 h-6 text-white" aria-hidden />
        </div>
        {error ? (
          <>
            <AlertTriangle className="w-6 h-6 text-[#8A5A00] mx-auto mb-3" aria-hidden />
            <p className="text-[#14161A]/80 text-body-sm mb-5">{error}</p>
            <Link href="/login" className="login-btn-primary inline-flex">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="w-5 h-5 text-[#14161A]/60 mx-auto mb-3 animate-spin" aria-hidden />
            <p className="text-[#14161A]/60 text-body-sm">Signing you in…</p>
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
