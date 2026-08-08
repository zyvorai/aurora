'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Globe, Sparkles, Workflow, Zap, ShieldCheck } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AppFooter } from '@/components/layout/AppHeader';
import { cn } from '@/lib/cn';
import { resolvePostLoginRoute, storeAuthSession } from '@/lib/role-routing';
import { TextSmall } from '@/components/ui/Typography';

const FEATURES = [
  {
    icon: Globe,
    title: 'Auto-Discovery',
    description: 'Point at a URL — agents crawl and build a product profile automatically',
  },
  {
    icon: Workflow,
    title: 'Background Agents',
    description: 'Outbound sprints, technical evals, and proposals run without blocking the UI',
  },
  {
    icon: ShieldCheck,
    title: 'Grounded Answers',
    description: 'Every claim cited against real product knowledge — no hallucinated pitches',
  },
  {
    icon: Zap,
    title: 'Lean & Fast',
    description: 'Executive brief loads instantly — SQL-first, LLM only when you trigger it',
  },
];

const LOGIN_ORBS = [
  { size: 320, top: '2%', left: '4%', hue: 'primary' as const },
  { size: 220, top: '58%', left: '10%', hue: 'violet' as const },
  { size: 260, top: '30%', left: '68%', hue: 'sky' as const },
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
      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Hero — dark glass panel with orb decorations and feature showcase */}
        <section className="login-hero hidden lg:flex lg:w-[56%] flex-col justify-between p-12 xl:p-16 relative">
          {LOGIN_ORBS.map((orb, i) => (
            <div
              key={i}
              className={`login-orb login-orb-${orb.hue}`}
              style={{ width: orb.size, height: orb.size, top: orb.top, left: orb.left }}
            />
          ))}

          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-10">
              <div className="tahoe-icon-badge">
                <Sparkles className="w-6 h-6" aria-hidden />
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">Emissary</span>
            </div>
            <h1 className="text-4xl xl:text-[2.75rem] font-extrabold text-white leading-[1.1] mb-4 max-w-xl">
              Turn your technical product into an AI-powered GTM engine
            </h1>
            <p className="text-lg text-slate-300/90 max-w-lg leading-relaxed">
              Enterprise-grade go-to-market orchestration for sales, marketing, and partners — built for lean hardware.
            </p>
          </div>

          <div className="relative z-10 space-y-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="login-feature-card glass flex items-start gap-4 p-4"
              >
                <div className="tahoe-icon-badge shrink-0 !w-10 !h-10 !rounded-lg">
                  <f.icon className="w-5 h-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{f.title}</div>
                  <p className="text-xs mt-1 text-slate-400 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Auth panel */}
        <section className="flex-1 flex items-center justify-center px-6 py-16 lg:px-16 min-h-screen lg:min-h-0">
          <div className="w-full max-w-md animate-glass-in">
            {/* Mobile-only brand header (hero is hidden below lg) */}
            <div className="lg:hidden text-center mb-8">
              <div className="tahoe-icon-badge inline-flex mb-4">
                <Sparkles className="w-6 h-6" aria-hidden />
              </div>
              <h1 className="text-2xl font-bold">Emissary</h1>
              <p className="text-sm mt-1 text-muted">AI-powered GTM orchestration</p>
            </div>

            <Card strong className="login-panel-glass">
              <CardBody className="p-8">
                <div className="flex gap-2 mb-6">
                  {(['register', 'login'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={cn(
                        'flex-1 py-2 rounded-full text-body-sm font-medium transition-colors focus-ring',
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

            {mode === 'register' && (
              <p className="text-xs text-center mt-4 text-muted flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
                No credit card required — onboard your first product in minutes
              </p>
            )}
          </div>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
