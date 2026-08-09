'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Sparkles } from 'lucide-react';
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
      <Card strong className="login-glass login-glass-border">
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
    <Card strong className="login-glass login-glass-border">
      <CardBody className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="tahoe-icon-badge !w-10 !h-10 !rounded-lg">
            <Sparkles className="w-5 h-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">Become a reseller</h1>
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
          {error && <TextSmall className="text-danger">{error}</TextSmall>}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? 'Submitting…' : 'Apply as Reseller'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export default function ResellerSignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16 gradient-mesh">
      <div className="w-full max-w-md animate-glass-in">
        <Suspense fallback={null}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
