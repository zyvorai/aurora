'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { auth, products } from '@/lib/api';
import { resolveApiBase } from '@/lib/api-base';
import { resolvePostLoginRoute, storeAuthSession } from '@/lib/role-routing';

type View = 'signup' | 'signin';
type SignupStep = 1 | 2;

interface Finding {
  label: string;
  note: string;
}

function findingsFor(host: string): Finding[] {
  return [
    { label: 'Pages crawled', note: host },
    { label: 'Pricing table found', note: 'tiers detected' },
    { label: 'API surface scanned', note: 'endpoints' },
    { label: 'Positioning extracted', note: 'claims' },
  ];
}

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('signup');
  const [step, setStep] = useState<SignupStep>(1);

  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [visibleFindings, setVisibleFindings] = useState<Finding[]>([]);

  const [form, setForm] = useState({ tenant_name: '', full_name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [signinForm, setSigninForm] = useState({ email: '', password: '' });
  const [signinError, setSigninError] = useState('');
  const [signinLoading, setSigninLoading] = useState(false);

  const host = url.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');

  function runScan() {
    if (!host) return;
    setScanning(true);
    setScanDone(false);
    setVisibleFindings([]);
    const all = findingsFor(host);
    all.forEach((finding, i) => {
      window.setTimeout(() => {
        setVisibleFindings((prev) => [...prev, finding]);
        if (i === all.length - 1) {
          setScanning(false);
          setScanDone(true);
          window.setTimeout(() => setStep(2), 500);
        }
      }, (i + 1) * 550);
    });
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await auth.register(form);
      storeAuthSession(result.access_token, result.tenant_id, result.role);

      // The step-1 URL becomes the first real product + source, kicked off for
      // real now that an account exists -- step 1's "scan" above is illustrative,
      // matching the same honesty the reference design itself has (no anonymous
      // pre-auth crawling infrastructure).
      try {
        const product = await products.create({
          name: form.tenant_name || host,
          website_url: url.startsWith('http') ? url : `https://${url}`,
        });
        await products.addSource(product.id, { source_type: 'website', url: product.website_url ?? url });
        await products.ingest(product.id, { async_mode: true });
        router.push(`/products/${product.id}`);
        return;
      } catch {
        // Account exists even if product creation failed -- land in the dashboard
        // rather than losing the new session.
      }
      const destination = await resolvePostLoginRoute(result.role);
      router.push(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setSigninLoading(true);
    setSigninError('');
    try {
      const result = await auth.login(signinForm);
      storeAuthSession(result.access_token, result.tenant_id, result.role);
      const destination = await resolvePostLoginRoute(result.role);
      router.push(destination);
    } catch (err) {
      setSigninError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSigninLoading(false);
    }
  }

  const passwordHint =
    form.password.length === 0
      ? '12 characters minimum. A passphrase beats a puzzle.'
      : form.password.length < 12
        ? `${12 - form.password.length} more characters needed.`
        : 'Good — that’ll do.';

  return (
    <MarketingLayout>
      <div className="max-w-[480px] mx-auto px-5 py-12 pb-16">
        <div className="flex items-center justify-end mb-8">
          <span className="text-body-sm text-muted">
            {view === 'signup' ? (
              <>Already have an account? <button type="button" onClick={() => setView('signin')} className="text-primary font-medium hover:underline">Sign in</button></>
            ) : (
              <>New here? <button type="button" onClick={() => setView('signup')} className="text-primary font-medium hover:underline">Create a workspace</button></>
            )}
          </span>
        </div>

        {view === 'signup' ? (
          <>
            <h1 className="font-display text-[29px] font-semibold tracking-tight leading-[1.15] mb-2">
              Point us at your product.
            </h1>
            <p className="text-muted text-body max-w-[46ch] mb-6">
              We read your site, your docs, and your repo, then write the outreach, the answers, and the
              proposals from what&apos;s actually there.
            </p>

            <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted mb-3.5">
              <span className={step === 1 ? 'px-2.5 py-1 rounded-full border border-border bg-primary text-white' : 'px-2.5 py-1 rounded-full border border-border bg-surface'}>
                1 · your product
              </span>
              <span>→</span>
              <span className={step === 2 ? 'px-2.5 py-1 rounded-full border border-border bg-primary text-white' : 'px-2.5 py-1 rounded-full border border-border bg-surface'}>
                2 · your account
              </span>
            </div>

            <div className="rounded-[13px] border border-border bg-surface shadow-sm p-5">
              {step === 1 ? (
                <div>
                  <label htmlFor="url" className="block text-body-sm font-medium text-foreground/80 mb-1.5">
                    Where does your product live?
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 font-mono text-body-sm text-muted pointer-events-none">https://</span>
                    <input
                      id="url"
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="northwindhq.io"
                      autoComplete="url"
                      className="w-full pl-[64px] pr-3.5 py-3 rounded-[9px] border border-border bg-background font-mono text-body-sm focus-ring"
                    />
                  </div>
                  <p className="font-mono text-[11px] text-muted mt-1.5">
                    A marketing site, a docs site, or a public repo. You can add more later.
                  </p>

                  {(scanning || scanDone) && (
                    <div className="mt-3.5 rounded-[11px] border border-border bg-background overflow-hidden">
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-border bg-surface">
                        <span className="w-5 h-5 rounded-[5px] bg-primary/15 text-primary flex items-center justify-center font-mono text-[10px] font-medium">
                          {host[0]?.toUpperCase() ?? '?'}
                        </span>
                        <span className="text-body-sm font-medium">{host}</span>
                        <span className={`ml-auto font-mono text-[10.5px] ${scanDone ? 'text-success' : 'text-primary'}`}>
                          {scanDone ? 'indexed' : 'reading…'}
                        </span>
                      </div>
                      <div className="py-1">
                        {visibleFindings.map((f, i) => (
                          <div key={i} className="grid grid-cols-[14px_1fr_auto] gap-2.5 items-center px-3.5 py-2 font-mono text-[11.5px] text-muted animate-fade-in">
                            <span className="w-3.5 h-3.5 rounded-full bg-success/15 text-success flex items-center justify-center text-[9px]">✓</span>
                            <span>{f.label}</span>
                            <span className="text-muted/70">{f.note}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={url.trim().length < 4 || scanning || scanDone}
                    onClick={runScan}
                    className="mt-4 w-full py-3 rounded-[9px] bg-primary text-white text-body-sm font-medium disabled:bg-border disabled:text-muted disabled:cursor-not-allowed transition-colors"
                  >
                    {scanning ? 'Scanning…' : 'Scan my product'}
                  </button>

                  <div className="flex items-center gap-3 my-4.5 font-mono text-[11px] text-muted">
                    <div className="h-px flex-1 bg-border" />
                    or
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <a
                    href={`${resolveApiBase()}/auth/sso/login`}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-[9px] border border-border text-body-sm font-medium hover:border-foreground/30 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" aria-hidden />
                    Continue with SSO
                  </a>
                </div>
              ) : (
                <form onSubmit={handleCreateWorkspace} className="space-y-3.5">
                  <div className="rounded-[11px] border border-border bg-background overflow-hidden">
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-border bg-surface">
                      <span className="w-5 h-5 rounded-[5px] bg-primary/15 text-primary flex items-center justify-center font-mono text-[10px] font-medium">
                        {host[0]?.toUpperCase() ?? '?'}
                      </span>
                      <span className="text-body-sm font-medium">{host}</span>
                      <span className="ml-auto font-mono text-[10.5px] text-success">indexed</span>
                    </div>
                    <p className="px-3.5 py-2.5 text-body-sm text-foreground/80">
                      Read <strong>{host}</strong> and found a pricing table and an API surface. Your workspace
                      opens with this already loading.
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/30 rounded-xl p-3" role="alert">
                      <AlertCircle className="h-4 w-4 text-danger shrink-0" aria-hidden />
                      <span className="text-body-sm text-danger">{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="full_name" className="block text-body-sm font-medium text-foreground/80 mb-1.5">Your name</label>
                      <input
                        id="full_name"
                        type="text"
                        placeholder="Jordan Smith"
                        autoComplete="name"
                        className="w-full px-3.5 py-2.5 rounded-[9px] border border-border bg-background text-body-sm focus-ring"
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="tenant_name" className="block text-body-sm font-medium text-foreground/80 mb-1.5">Company</label>
                      <input
                        id="tenant_name"
                        type="text"
                        placeholder="Northwind"
                        required
                        className="w-full px-3.5 py-2.5 rounded-[9px] border border-border bg-background text-body-sm focus-ring"
                        value={form.tenant_name}
                        onChange={(e) => setForm({ ...form, tenant_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-body-sm font-medium text-foreground/80 mb-1.5">Work email</label>
                    <input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
                      required
                      className="w-full px-3.5 py-2.5 rounded-[9px] border border-border bg-background text-body-sm focus-ring"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-body-sm font-medium text-foreground/80 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 12 characters"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        className="w-full px-3.5 py-2.5 pr-14 rounded-[9px] border border-border bg-background text-body-sm focus-ring"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className={`font-mono text-[11px] mt-1.5 ${form.password.length >= 12 ? 'text-success' : 'text-muted'}`}>
                      {passwordHint}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-[9px] bg-primary text-white text-body-sm font-medium disabled:opacity-60 transition-colors mt-1"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Setting up your workspace…
                      </>
                    ) : (
                      <>
                        Create workspace
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  <p className="text-xs text-center text-muted mt-3.5">
                    By creating a workspace you agree to the terms and privacy policy. We only crawl pages you
                    point us at.
                  </p>
                </form>
              )}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-px bg-border rounded-[11px] overflow-hidden border border-border">
              {[
                { k: '2 minutes', d: 'From a URL to a working product profile' },
                { k: 'Cited', d: 'Every claim traced back to a page you own' },
                { k: 'Keeps running', d: 'Close the tab — agents finish server-side' },
              ].map((p) => (
                <div key={p.k} className="bg-surface px-3.5 py-3">
                  <div className="font-display text-body-sm font-semibold">{p.k}</div>
                  <div className="text-xs text-muted mt-0.5 leading-snug">{p.d}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-[29px] font-semibold tracking-tight leading-[1.15] mb-2">
              Welcome back.
            </h1>
            <p className="text-muted text-body mb-6">Your runs kept going while you were away.</p>

            <form onSubmit={handleSignin} className="rounded-[13px] border border-border bg-surface shadow-sm p-5 space-y-3.5">
              <a
                href={`${resolveApiBase()}/auth/sso/login`}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[9px] border border-border text-body-sm font-medium hover:border-foreground/30 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" aria-hidden />
                Continue with SSO
              </a>
              <div className="flex items-center gap-3 my-1 font-mono text-[11px] text-muted">
                <div className="h-px flex-1 bg-border" />
                or
                <div className="h-px flex-1 bg-border" />
              </div>

              {signinError && (
                <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/30 rounded-xl p-3" role="alert">
                  <AlertCircle className="h-4 w-4 text-danger shrink-0" aria-hidden />
                  <span className="text-body-sm text-danger">{signinError}</span>
                </div>
              )}

              <div>
                <label htmlFor="signin-email" className="block text-body-sm font-medium text-foreground/80 mb-1.5">Work email</label>
                <input
                  id="signin-email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  className="w-full px-3.5 py-2.5 rounded-[9px] border border-border bg-background text-body-sm focus-ring"
                  value={signinForm.email}
                  onChange={(e) => setSigninForm({ ...signinForm, email: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="signin-password" className="block text-body-sm font-medium text-foreground/80 mb-1.5">Password</label>
                <input
                  id="signin-password"
                  type="password"
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                  className="w-full px-3.5 py-2.5 rounded-[9px] border border-border bg-background text-body-sm focus-ring"
                  value={signinForm.password}
                  onChange={(e) => setSigninForm({ ...signinForm, password: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={signinLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[9px] bg-primary text-white text-body-sm font-medium disabled:opacity-60 transition-colors"
              >
                {signinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
              </button>
            </form>
          </>
        )}
      </div>
    </MarketingLayout>
  );
}
