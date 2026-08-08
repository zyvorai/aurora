'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AppFooter } from '@/components/layout/AppHeader';
import { cn } from '@/lib/cn';
import { resolvePostLoginRoute, storeAuthSession } from '@/lib/role-routing';
import { DisplayTitle, Eyebrow, TextLead, TextSmall } from '@/components/ui/Typography';

const VALUE_PROPS = [
  'Onboard any product with a URL — agents crawl and build a profile automatically',
  'Run outbound sprints, technical evals, and proposals without blocking the UI',
  'Executive brief loads instantly — SQL-first, LLM only when you trigger it',
];

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [form, setForm] = useState({ tenant_name: '', email: '', password: '', full_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { auth } = await import('@/lib/api');
      const result = mode === 'register'
        ? await auth.register(form)
        : await auth.login({ email: form.email, password: form.password });
      storeAuthSession(result.access_token, result.tenant_id, result.role);
      const destination = await resolvePostLoginRoute(result.role);
      router.push(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 grid lg:grid-cols-2 gap-0">
        {/* Hero — Red Hat split layout */}
        <section className="flex flex-col justify-center px-8 py-16 lg:py-24 lg:px-16 border-b lg:border-b-0 lg:border-r border-border">
          <Eyebrow className="mb-4">Emissary</Eyebrow>
          <DisplayTitle className="mb-6">
            Turn your technical product into an AI-powered GTM engine
          </DisplayTitle>
          <TextLead className="mb-8 max-w-lg">
            Enterprise-grade go-to-market orchestration for sales, marketing, and partners — built for lean hardware.
          </TextLead>
          <ul className="space-y-4">
            {VALUE_PROPS.map((prop) => (
              <li key={prop} className="flex gap-3 text-body text-muted">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden />
                {prop}
              </li>
            ))}
          </ul>
        </section>

        {/* Auth card */}
        <section className="flex items-center justify-center px-6 py-16 lg:px-16">
          <div className="w-full max-w-md animate-fade-up">
            <Card elevated>
              <CardBody className="p-8">
                <div className="flex gap-2 mb-6">
                  {(['register', 'login'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={cn(
                        'flex-1 py-2 rounded-md text-body-sm font-medium transition-colors focus-ring',
                        mode === m
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted hover:text-foreground',
                      )}
                    >
                      {m === 'register' ? 'Get Started' : 'Sign In'}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'register' && (
                    <>
                      <Input
                        type="text"
                        placeholder="Company name"
                        required
                        value={form.tenant_name}
                        onChange={(e) => setForm({ ...form, tenant_name: e.target.value })}
                      />
                      <Input
                        type="text"
                        placeholder="Your name"
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      />
                    </>
                  )}
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
                  {error && <TextSmall className="text-danger">{error}</TextSmall>}
                  <Button type="submit" disabled={loading} className="w-full" size="lg">
                    {loading ? 'Loading…' : mode === 'register' ? 'Create Account' : 'Sign In'}
                  </Button>
                </form>
              </CardBody>
            </Card>
          </div>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
