'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextSmall } from '@/components/ui/Typography';
import { resellerPortal } from '@/lib/portal-api';

function SignupForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    tenant_slug: searchParams.get('tenant') ?? '',
    email: '',
    password: '',
    company_name: '',
    contact_name: '',
    business_id: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUploadError, setDocumentUploadError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await resellerPortal.signup(form);
      if (documentFile) {
        try {
          await resellerPortal.uploadDocument(result.id, documentFile);
        } catch (err) {
          setDocumentUploadError(
            err instanceof Error ? err.message : 'Document upload failed -- you can skip this and provide it later.',
          );
        }
      }
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
          <h1 className="text-xl font-semibold mb-2">Request received</h1>
          <p className="text-muted text-body-sm">
            An administrator will review your partner application. You&apos;ll be able to sign in
            once approved.
          </p>
          {documentUploadError && (
            <p className="text-danger text-body-sm mt-3">{documentUploadError}</p>
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card elevated>
      <CardBody className="p-8">
        <h1 className="text-[28px] font-semibold tracking-tight mb-6">Become a reseller</h1>
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
            placeholder="Company name"
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
          />
          <Input
            type="text"
            placeholder="Business ID / tax ID"
            value={form.business_id}
            onChange={(e) => setForm({ ...form, business_id: e.target.value })}
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
          <div>
            <label className="text-body-sm text-muted mb-1.5 block">
              Proof of business (optional)
            </label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
              className="w-full text-body-sm text-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--glass-bg)] file:text-foreground hover:file:bg-[var(--glass-bg-elevated)] file:cursor-pointer cursor-pointer"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-[var(--radius-md)] p-3 login-shake">
              <AlertCircle className="w-4 h-4 text-danger shrink-0" aria-hidden />
              <TextSmall className="text-danger">{error}</TextSmall>
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply as Reseller'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export default function ResellerSignupPage() {
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
