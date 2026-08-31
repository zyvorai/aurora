'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { PortalAuthShell } from '@/components/portal/PortalAuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextSmall } from '@/components/ui/Typography';
import { salesPersonPortal } from '@/lib/portal-api';

function SignupForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    tenant_slug: searchParams.get('tenant') ?? '',
    email: '',
    password: '',
    contact_name: '',
    territory: '',
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
      const result = await salesPersonPortal.signup(form);
      if (documentFile) {
        try {
          await salesPersonPortal.uploadDocument(result.id, documentFile);
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
      <div className="text-center py-2">
        <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-4" aria-hidden />
        <h2 className="text-xl font-semibold mb-2">Request received</h2>
        <p className="text-muted text-body-sm">
          An administrator will review your sales rep application. You&apos;ll be able to sign in
          once approved.
        </p>
        {documentUploadError && <p className="text-danger text-body-sm mt-3">{documentUploadError}</p>}
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
        placeholder="Your name"
        value={form.contact_name}
        onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
      />
      <Input
        type="text"
        placeholder="Territory (optional)"
        value={form.territory}
        onChange={(e) => setForm({ ...form, territory: e.target.value })}
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
        <label className="text-body-sm text-muted mb-1.5 block">Proof of business (optional)</label>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
          className="w-full text-body-sm text-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--glass-bg)] file:text-foreground hover:file:bg-[var(--glass-bg-elevated)] file:cursor-pointer cursor-pointer"
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 bg-danger/10 rounded-[var(--radius-md)] p-3 login-shake">
          <AlertCircle className="w-4 h-4 text-danger shrink-0" aria-hidden />
          <TextSmall className="text-danger">{error}</TextSmall>
        </div>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply as sales rep'}
      </Button>
    </form>
  );
}

export default function SalesPersonSignupPage() {
  return (
    <MarketingLayout>
      <PortalAuthShell eyebrow="Sales portal" title="Become a sales rep">
        <Suspense fallback={null}>
          <SignupForm />
        </Suspense>
      </PortalAuthShell>
    </MarketingLayout>
  );
}
