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
  Github,
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
import { resolveApiBase } from '@/lib/api-base';
import { resolvePostLoginRoute, storeAuthSession } from '@/lib/role-routing';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A11.998 11.998 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A11.998 11.998 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: <Globe className="w-4 h-4" />,
    title: 'Auto-Discovery',
    description: 'Point at a URL — agents crawl and build a product profile automatically',
  },
  {
    icon: <Workflow className="w-4 h-4" />,
    title: 'Background Agents',
    description: 'Outbound sprints, technical evals, and proposals run without blocking the UI',
  },
  {
    icon: <ShieldCheck className="w-4 h-4" />,
    title: 'Grounded Answers',
    description: 'Every claim cited against real product knowledge — no hallucinated pitches',
  },
  {
    icon: <Zap className="w-4 h-4" />,
    title: 'Lean & Fast',
    description: 'Executive brief loads instantly — SQL-first, LLM only when you trigger it',
  },
  {
    icon: <Send className="w-4 h-4" />,
    title: 'Omnichannel Publishing',
    description: 'Push content to LinkedIn, X, Medium, Dev.to, Reddit, and email — suppression-aware',
  },
  {
    icon: <Users className="w-4 h-4" />,
    title: 'Multi-Tenant Workspaces',
    description: 'Role-based landings route marketing, sales, and reseller users to the view they need',
  },
  {
    icon: <Boxes className="w-4 h-4" />,
    title: '16 Specialized Agents',
    description: 'Product, market research, outreach, proposals, support, and more — each its own compute tier',
  },
  {
    icon: <ListChecks className="w-4 h-4" />,
    title: 'Immutable Audit Trail',
    description: 'Every write, approve, and publish action logged — filterable, exportable, compliance-ready',
  },
  {
    icon: <Cpu className="w-4 h-4" />,
    title: 'Bring Your Own LLM',
    description: 'Free local Ollama for dev, OpenAI for production — switch with a single env var',
  },
  {
    icon: <KeyRound className="w-4 h-4" />,
    title: 'SSO Ready',
    description: 'Generic OIDC — Auth0, Keycloak, or any compliant identity provider',
  },
  {
    icon: <Compass className="w-4 h-4" />,
    title: 'Role-Based Landing',
    description: 'Admins, editors, approvers, and viewers each land on the workspace built for their job',
  },
  {
    icon: <Database className="w-4 h-4" />,
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
        <div className="w-14 h-14 rounded-xl bg-[#C1503C] flex items-center justify-center border border-white/15">
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
          <div className="flex items-center gap-2 text-[#F2EFE6]/40 text-sm">
            <span>Auto-discovery</span>
            <span className="text-[#F2EFE6]/25">·</span>
            <span>Grounded answers</span>
            <span className="text-[#F2EFE6]/25">·</span>
            <span>Emissary</span>
          </div>
          <Link
            href="/features"
            className="flex items-center gap-1 text-sm text-[#F2EFE6]/70 hover:text-white transition-colors shrink-0"
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
          <p className="text-xs text-center text-[#1A1F1F]/50 flex items-center justify-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-[#C1503C] shrink-0" aria-hidden />
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
              mode === m ? 'bg-primary text-primary-foreground' : 'text-[#1A1F1F]/50 hover:text-[#1A1F1F]',
            )}
          >
            {m === 'register' ? 'Get Started' : 'Sign In'}
          </button>
        ))}
      </div>

      {error ? <LoginError message={error} /> : null}

      <div className="grid grid-cols-2 gap-3 mb-5">
        <a
          href={`${resolveApiBase()}/auth/oauth/google/start`}
          className="login-input flex items-center justify-center gap-2 !pl-0 hover:border-[#1A1F1F]/25 transition-colors"
        >
          <GoogleMark />
          <span>Google</span>
        </a>
        <a
          href={`${resolveApiBase()}/auth/oauth/github/start`}
          className="login-input flex items-center justify-center gap-2 !pl-0 hover:border-[#1A1F1F]/25 transition-colors"
        >
          <Github className="w-4 h-4" aria-hidden />
          <span>GitHub</span>
        </a>
      </div>

      <div className="flex items-center gap-3 mb-5 text-xs text-[#1A1F1F]/35">
        <div className="h-px flex-1 bg-[#1A1F1F]/[0.08]" />
        <span>or continue with email</span>
        <div className="h-px flex-1 bg-[#1A1F1F]/[0.08]" />
      </div>

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
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#1A1F1F]/40 hover:text-[#1A1F1F]/70 transition-colors"
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

      <div className="mt-6 pt-5 border-t border-[#1A1F1F]/[0.08] flex items-center justify-center gap-2 text-xs text-[#1A1F1F]/45">
        <ShieldCheck className="h-3.5 w-3.5 text-[#C1503C]" />
        <span>Secured with JWT session authentication</span>
      </div>
    </LoginShell>
  );
}
