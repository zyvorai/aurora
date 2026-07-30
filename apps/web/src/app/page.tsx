'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
      localStorage.setItem('token', result.access_token);
      localStorage.setItem('tenant_id', result.tenant_id);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <section className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-lg animate-fade-up">
          <div className="text-center mb-10">
            <p className="text-gtm-accent font-mono text-sm tracking-widest uppercase mb-4">
              GTM Agent Platform
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Turn your technical product into an AI-powered salesperson
            </h1>
            <p className="text-[var(--text-secondary)] text-lg">
              Onboard with a URL. Get marketing, sales, and solution agents automatically.
            </p>
          </div>

          <div className="bg-gtm-card border border-gtm-border rounded-lg p-8">
            <div className="flex gap-2 mb-6">
              {(['register', 'login'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    mode === m
                      ? 'bg-gtm-accent text-gtm-bg'
                      : 'text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  {m === 'register' ? 'Get Started' : 'Sign In'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <input
                    type="text"
                    placeholder="Company name"
                    required
                    value={form.tenant_name}
                    onChange={(e) => setForm({ ...form, tenant_name: e.target.value })}
                    className="w-full px-4 py-3 bg-gtm-bg border border-gtm-border rounded-md text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-gtm-accent"
                  />
                  <input
                    type="text"
                    placeholder="Your name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full px-4 py-3 bg-gtm-bg border border-gtm-border rounded-md text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-gtm-accent"
                  />
                </>
              )}
              <input
                type="email"
                placeholder="Email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 bg-gtm-bg border border-gtm-border rounded-md text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-gtm-accent"
              />
              <input
                type="password"
                placeholder="Password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 bg-gtm-bg border border-gtm-border rounded-md text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-gtm-accent"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gtm-accent hover:bg-[var(--accent-hover)] text-gtm-bg font-semibold rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : mode === 'register' ? 'Create Account' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
