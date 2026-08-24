'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { Card, CardBody } from '@/components/ui/Card';
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
      <Card elevated>
        <CardBody className="p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-4" aria-hidden />
          <h1 className="text-[28px] font-semibold tracking-tight mb-2">Request received</h1>
          <p className="text-muted text-body-sm">
            An administrator will review your request. You&apos;ll be able to sign in once your
            account is approved.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card elevated>
      <CardBody className="p-8">
        <h1 className="text-[28px] font-semibold tracking-tight mb-6">Request portal access</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-[var(--radius-md)] p-3 login-shake">
              <AlertCircle className="w-4 h-4 text-danger shrink-0" aria-hidden />
              <TextSmall className="text-danger">{error}</TextSmall>
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Request Access'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export default function CustomerSignupPage() {
  return (
    <MarketingLayout>
      <div className="max-w-[480px] mx-auto px-5 py-12">
        <Suspense fallback={null}>
          <SignupForm />
        </Suspense>
      </div>
    </MarketingLayout>
  );
}
