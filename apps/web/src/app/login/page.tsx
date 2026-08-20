'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle,
  Compass,
  Cpu,
  Database,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  ListChecks,
  Loader2,
  Lock,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { LoginShell, LoginError, LoginField } from '@/components/login/LoginShell';
import { cn } from '@/lib/cn';
import { resolvePostLoginRoute, storeAuthSession } from '@/lib/role-routing';

const FEATURES = [
  {
    icon: <Globe className="w-5 h-5 text-blue-100" />,
    gradient: 'from-blue-500/95 to-indigo-700/95',
    glow: 'shadow-blue-500/25',
    title: 'Auto-Discovery',
    description: 'Point at a URL — agents crawl and build a product profile automatically',
  },
  {
    icon: <Workflow className="w-5 h-5 text-sky-100" />,
    gradient: 'from-sky-500/95 to-indigo-800/95',
    glow: 'shadow-sky-500/25',
    title: 'Background Agents',
    description: 'Outbound sprints, technical evals, and proposals run without blocking the UI',
  },
  {
    icon: <ShieldCheck className="w-5 h-5 text-violet-100" />,
    gradient: 'from-violet-500/95 to-purple-800/95',
    glow: 'shadow-violet-500/25',
    title: 'Grounded Answers',
    description: 'Every claim cited against real product knowledge — no hallucinated pitches',
  },
  {
    icon: <Zap className="w-5 h-5 text-cyan-100" />,
    gradient: 'from-cyan-500/95 to-blue-800/95',
    glow: 'shadow-cyan-500/25',
    title: 'Lean & Fast',
    description: 'Executive brief loads instantly — SQL-first, LLM only when you trigger it',
  },
  {
    icon: <Send className="w-5 h-5 text-emerald-100" />,
    gradient: 'from-emerald-500/95 to-teal-800/95',
    glow: 'shadow-emerald-500/25',
    title: 'Omnichannel Publishing',
    description: 'Push content to LinkedIn, X, Medium, Dev.to, Reddit, and email — suppression-aware',
  },
  {
    icon: <Users className="w-5 h-5 text-amber-100" />,
    gradient: 'from-amber-500/95 to-orange-800/95',
    glow: 'shadow-amber-500/25',
    title: 'Multi-Tenant Workspaces',
    description: 'Role-based landings route marketing, sales, and reseller users to the view they need',
  },
  {
    icon: <Boxes className="w-5 h-5 text-rose-100" />,
    gradient: 'from-rose-500/95 to-pink-800/95',
    glow: 'shadow-rose-500/25',
    title: '16 Specialized Agents',
    description: 'Product, market research, outreach, proposals, support, and more — each its own compute tier',
  },
  {
    icon: <ListChecks className="w-5 h-5 text-teal-100" />,
    gradient: 'from-teal-500/95 to-cyan-800/95',
    glow: 'shadow-teal-500/25',
    title: 'Immutable Audit Trail',
    description: 'Every write, approve, and publish action logged — filterable, exportable, compliance-ready',
  },
  {
    icon: <Cpu className="w-5 h-5 text-indigo-100" />,
    gradient: 'from-indigo-500/95 to-blue-900/95',
    glow: 'shadow-indigo-500/25',
    title: 'Bring Your Own LLM',
    description: 'Free local Ollama for dev, OpenAI for production — switch with a single env var',
  },
  {
    icon: <KeyRound className="w-5 h-5 text-fuchsia-100" />,
    gradient: 'from-fuchsia-500/95 to-purple-900/95',
    glow: 'shadow-fuchsia-500/25',
    title: 'SSO Ready',
    description: 'Generic OIDC — Auth0, Keycloak, or any compliant identity provider',
  },
  {
    icon: <Compass className="w-5 h-5 text-lime-100" />,
    gradient: 'from-lime-500/95 to-green-800/95',
    glow: 'shadow-lime-500/25',
    title: 'Role-Based Landing',
    description: 'Admins, editors, approvers, and viewers each land on the workspace built for their job',
  },
  {
    icon: <Database className="w-5 h-5 text-sky-100" />,
    gradient: 'from-sky-500/95 to-indigo-900/95',
    glow: 'shadow-sky-500/25',
    title: 'Full Data Control',
    description: 'Export or purge tenant knowledge on demand — every action logged to the audit trail',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [form, setForm] = useState({ tenant_name: '', email: '', password: '', full_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <LoginShell
      logo={
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30 border border-white/20">
          <Sparkles className="w-7 h-7 text-white" aria-hidden />
        </div>
      }
      productName="Emissary"
      productSubtitle="GTM Orchestration Platform"
      heroHeadline={
        <>
          Turn your product into
          <br />
          <span className="login-text-gradient">an AI-powered GTM engine</span>
        </>
      }
      heroSubheadline="Enterprise-grade go-to-market orchestration for sales, marketing, and partners — built for lean hardware."
      pills={[
        { icon: <Zap className="w-3 h-3" />, label: 'Background agents' },
        { label: 'SQL-first briefs' },
        { label: 'Multi-tenant' },
      ]}
      features={FEATURES}
      heroFooter={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-blue-100/40 text-sm">
            <span>Auto-discovery</span>
            <span className="text-blue-200/30">·</span>
            <span>Grounded answers</span>
            <span className="text-blue-200/30">·</span>
            <span>Emissary</span>
          </div>
          <Link
            href="/features"
            className="flex items-center gap-1 text-sm text-blue-200/70 hover:text-blue-100 transition-colors shrink-0"
          >
            See how it works
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      }
      mobileSubtitle="GTM Orchestration Platform"
      panelTitle={mode === 'register' ? 'Get started' : 'Welcome back'}
      panelSubtitle={mode === 'register' ? 'Create your workspace in minutes' : 'Sign in to your workspace'}
      footer={
        mode === 'register' ? (
          <p className="text-xs text-center text-white/45 flex items-center justify-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-blue-400/80 shrink-0" aria-hidden />
            No credit card required — onboard your first product in minutes
          </p>
        ) : null
      }
    >
      <div className="flex gap-2 mb-6">
        {(['register', 'login'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'flex-1 py-2 rounded-full text-body-sm font-medium transition-colors focus-ring',
              mode === m ? 'bg-primary text-primary-foreground' : 'text-white/60 hover:text-white',
            )}
          >
            {m === 'register' ? 'Get Started' : 'Sign In'}
          </button>
        ))}
      </div>

      {error ? <LoginError message={error} /> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        {mode === 'register' && (
          <>
            <LoginField id="tenant_name" label="Company name" icon={<Building2 className="login-field-icon" aria-hidden />}>
              <input
                id="tenant_name"
                type="text"
                placeholder="Acme Corp"
                required
                className="login-input"
                value={form.tenant_name}
                onChange={(e) => setForm({ ...form, tenant_name: e.target.value })}
              />
            </LoginField>
            <LoginField id="full_name" label="Your name" icon={<User className="login-field-icon" aria-hidden />}>
              <input
                id="full_name"
                type="text"
                placeholder="Jordan Smith"
                className="login-input"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </LoginField>
          </>
        )}

        <LoginField id="email" label="Email" icon={<Mail className="login-field-icon" aria-hidden />}>
          <input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            required
            className="login-input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </LoginField>

        <LoginField id="password" label="Password" icon={<Lock className="login-field-icon" aria-hidden />}>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
            minLength={8}
            className="login-input pr-11"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/75 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </LoginField>

        <button type="submit" disabled={loading} className="login-btn-primary group">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin relative z-10" />
              <span className="relative z-10">
                {mode === 'register' ? 'Creating account…' : 'Signing in…'}
              </span>
            </>
          ) : (
            <>
              <span className="relative z-10">{mode === 'register' ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="h-4 w-4 relative z-10" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-white/[0.08] flex items-center justify-center gap-2 text-xs text-white/45">
        <ShieldCheck className="h-3.5 w-3.5 text-blue-400/80" />
        <span>Secured with JWT session authentication</span>
      </div>
    </LoginShell>
  );
}
