'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { PortalAuthShell } from '@/components/portal/PortalAuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextSmall } from '@/components/ui/Typography';
import { portal } from '@/lib/portal-api';

function SignupForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    tenant_slug: searchParams.get('tenant') ?? '',
    product_id: searchParams.get('product') ?? '',
    email: '',
    password: '',
    company_name: '',
    contact_name: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await portal.signup(form);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-2">
        <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-4" aria-hidden />
        <h2 className="text-xl font-semibold tracking-tight mb-2">Request received</h2>
        <p className="text-muted text-body-sm">
          An administrator will review your request. You&apos;ll be able to sign in once your
          account is approved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        type="text"
        placeholder="Tenant slug"
        required
        value={form.tenant_slug}
        onChange={(e) => setForm({ ...form, tenant_slug: e.target.value })}
      />
      <Input
        type="text"
        placeholder="Product ID"
        required
        value={form.product_id}
        onChange={(e) => setForm({ ...form, product_id: e.target.value })}
      />
      <Input
        type="text"
        placeholder="Company name"
        value={form.company_name}
        onChange={(e) => setForm({ ...form, company_name: e.target.value })}
      />
      <Input
        type="text"
        placeholder="Your name"
        value={form.contact_name}
        onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
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
        minLength={8}
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      {error && (
        <div className="flex items-center gap-2 bg-danger/10 rounded-[var(--radius-md)] p-3 login-shake">
          <AlertCircle className="w-4 h-4 text-danger shrink-0" aria-hidden />
          <TextSmall className="text-danger">{error}</TextSmall>
        </div>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Request access'}
      </Button>
    </form>
  );
}

export default function CustomerSignupPage() {
  return (
    <MarketingLayout>
      <PortalAuthShell eyebrow="Customer portal" title="Request access">
        <Suspense fallback={null}>
          <SignupForm />
        </Suspense>
      </PortalAuthShell>
    </MarketingLayout>
  );
}
