'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextSmall } from '@/components/ui/Typography';
import { salesPersonPortal } from '@/lib/portal-api';
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
      const result = await salesPersonPortal.login(form);
      storePortalSession(result.access_token, 'salesperson', result.account_id, result.tenant_id, form.tenant_slug);
      router.push('/portal/salesperson');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card strong>
      <CardBody className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="tahoe-icon-badge tahoe-icon-badge-teal !w-10 !h-10 !rounded-lg">
            <Sparkles className="w-5 h-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">Sales rep sign in</h1>
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
          Not registered yet? <a href="/portal/salesperson/signup" className="text-primary hover:underline">Apply here</a>
        </p>
      </CardBody>
    </Card>
  );
}

export default function SalesPersonLoginPage() {
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
