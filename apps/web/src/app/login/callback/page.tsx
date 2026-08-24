'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
    <MarketingLayout>
      <div className="max-w-[480px] mx-auto px-5 py-16">
        <Card elevated>
          <CardBody className="p-8 text-center">
            {error ? (
              <>
                <AlertTriangle className="w-6 h-6 text-warning mx-auto mb-3" aria-hidden />
                <h1 className="text-[28px] font-semibold tracking-tight mb-2">Sign-in failed</h1>
                <p className="text-muted text-body-sm mb-6">{error}</p>
                <Link href="/login">
                  <Button type="button">Back to sign in</Button>
                </Link>
              </>
            ) : (
              <>
                <Loader2 className="w-5 h-5 text-muted mx-auto mb-3 animate-spin" aria-hidden />
                <h1 className="text-[28px] font-semibold tracking-tight mb-2">Signing you in</h1>
                <p className="text-muted text-body-sm">Just a moment…</p>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </MarketingLayout>
  );
}

export default function LoginCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
