'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { submitPublicInboundLead } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import forgeStyles from '@/components/workflow/forge.module.css';

export default function PublicInboundFormPage() {
  const searchParams = useSearchParams();
  const productId = searchParams.get('product') ?? '';
  const embedKey = searchParams.get('key') ?? '';
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !embedKey) {
      setError('Invalid embed configuration.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      await submitPublicInboundLead({
        product_id: productId,
        embed_key: embedKey,
        email,
        name: name || undefined,
        company: company || undefined,
        title: title || undefined,
        phone: phone || undefined,
        utm_source: params.get('utm_source') ?? undefined,
        utm_campaign: params.get('utm_campaign') ?? undefined,
        utm_medium: params.get('utm_medium') ?? undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  }

  if (!productId || !embedKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--app-canvas)] p-6">
        <p className="text-muted text-[15px]">This form link is invalid or expired.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--app-canvas)] p-6">
        <div className={`${forgeStyles.spotlight} max-w-md w-full text-center`}>
          <h1 className={forgeStyles.spotlightTitle}>Thanks — we&apos;ll be in touch</h1>
          <p className={forgeStyles.spotlightBody}>Your request was received.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app-canvas)] p-6">
      <div className={`${forgeStyles.spotlight} max-w-md w-full`}>
        <h1 className={forgeStyles.spotlightTitle}>Get in touch</h1>
        <p className={`${forgeStyles.spotlightBody} mb-5`}>Tell us about your team and we&apos;ll follow up shortly.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" required disabled={loading} />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" disabled={loading} />
          <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" disabled={loading} />
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" disabled={loading} />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" disabled={loading} />
          {error ? <p className="text-[13px] text-warning">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending…' : 'Submit'}
          </Button>
        </form>
      </div>
    </div>
  );
}
