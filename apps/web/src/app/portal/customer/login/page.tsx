'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextSmall } from '@/components/ui/Typography';
import { portal } from '@/lib/portal-api';
import { storePortalSession } from '@/lib/portal-auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    tenant_slug: searchParams.get('tenant') ?? '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await portal.login(form);
      storePortalSession(result.access_token, 'customer', result.account_id, result.tenant_id, form.tenant_slug);
      router.push('/portal/customer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card elevated>
      <CardBody className="p-8">
        <h1 className="text-[28px] font-semibold tracking-tight mb-6">Customer sign in</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Tenant slug"
            required
            value={form.tenant_slug}
            onChange={(e) => setForm({ ...form, tenant_slug: e.target.value })}
          />
          <Input
            type="email"
            placeholder="Email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            type="password"
            placeholder="Password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {error && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-[var(--radius-md)] p-3 login-shake">
              <AlertCircle className="w-4 h-4 text-danger shrink-0" aria-hidden />
              <TextSmall className="text-danger">{error}</TextSmall>
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
          </Button>
        </form>
        <p className="text-xs text-center mt-4 text-muted">
          No account yet? <a href="/portal/customer/signup" className="text-primary hover:underline">Request access</a>
        </p>
      </CardBody>
    </Card>
  );
}

export default function CustomerLoginPage() {
  return (
    <MarketingLayout>
      <div className="max-w-[480px] mx-auto px-5 py-12">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </MarketingLayout>
  );
}
