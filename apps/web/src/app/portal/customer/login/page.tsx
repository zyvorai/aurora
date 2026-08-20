'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
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
    <Card strong className="login-glass">
      <CardBody className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="tahoe-icon-badge !w-10 !h-10 !rounded-lg">
            <Sparkles className="w-5 h-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">Customer sign in</h1>
        </div>
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
          {error && <TextSmall className="text-danger">{error}</TextSmall>}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? 'Signing in…' : 'Sign In'}
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
    <div className="min-h-screen flex items-center justify-center px-6 py-16 gradient-mesh">
      <div className="w-full max-w-md animate-glass-in">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
