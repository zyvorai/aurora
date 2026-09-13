'use client';

import { FormEvent, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, products } from '@/lib/api';
import { resolveApiBase } from '@/lib/api-base';
import { readStoredRole, resolvePostLoginRoute, storeAuthSession } from '@/lib/role-routing';
import { ZyvorMark } from '@/components/ZyvorMark';
import styles from './login.module.css';

type Mode = 'signin' | 'signup';
type SigninStep = 'email' | 'password';
type SignupStep = 'product' | 'account';

export default function LoginPage() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();

  const [mode, setMode] = useState<Mode>('signin');
  const [signinStep, setSigninStep] = useState<SigninStep>('email');
  const [signupStep, setSignupStep] = useState<SignupStep>('product');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [url, setUrl] = useState('');
  const [signup, setSignup] = useState({
    tenant_name: '',
    full_name: '',
    email: '',
    password: '',
  });

  const host = url.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const avatarLetter = (email || signup.email || 'A').trim().charAt(0).toUpperCase() || 'A';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('token')) return;
    void resolvePostLoginRoute(readStoredRole() ?? 'admin').then((route) => {
      router.replace(route);
    });
  }, [router]);

  function resetErrors() {
    setError('');
  }

  function switchMode(next: Mode) {
    setMode(next);
    setSigninStep('email');
    setSignupStep('product');
    setPassword('');
    resetErrors();
  }

  function continueWithEmail(e: FormEvent) {
    e.preventDefault();
    resetErrors();
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setSigninStep('password');
  }

  async function submitSignin(e: FormEvent) {
    e.preventDefault();
    resetErrors();
    setLoading(true);
    try {
      const result = await auth.login({ email: email.trim(), password });
      storeAuthSession(result.access_token, result.tenant_id, result.role);
      router.push(await resolvePostLoginRoute(result.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function continueProduct(e: FormEvent) {
    e.preventDefault();
    resetErrors();
    if (host.length < 3) {
      setError('Enter your product site or docs URL.');
      return;
    }
    setSignupStep('account');
  }

  async function submitSignup(e: FormEvent) {
    e.preventDefault();
    resetErrors();
    setLoading(true);
    try {
      const result = await auth.register(signup);
      storeAuthSession(result.access_token, result.tenant_id, result.role);
      try {
        const product = await products.create({
          name: signup.tenant_name || host,
          website_url: url.startsWith('http') ? url : `https://${url}`,
        });
        await products.addSource(product.id, { source_type: 'website', url: product.website_url ?? url });
        await products.ingest(product.id, { async_mode: true });
        router.push(`/products/${product.id}`);
        return;
      } catch {
        // Account exists even if product bootstrap failed.
      }
      router.push(await resolvePostLoginRoute(result.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.atmosphere} aria-hidden />

      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          <ZyvorMark className={styles.brandMark} />
          <span>zyvor</span>
          <span className={styles.brandProduct}>Aurora</span>
        </Link>
        {mode === 'signin' ? (
          <button type="button" className={styles.topLink} onClick={() => switchMode('signup')}>
            Create account
          </button>
        ) : (
          <button type="button" className={styles.topLink} onClick={() => switchMode('signin')}>
            Sign in
          </button>
        )}
      </header>

      <main className={styles.hero}>
        <h1 className={styles.wordmark}>Aurora</h1>
        <p className={styles.tagline}>
          {mode === 'signin'
            ? 'Your product. An AI-powered GTM engine.'
            : 'Point us at your product. We build the rest.'}
        </p>

        <div className={styles.panel}>
          {mode === 'signin' && signinStep === 'email' && (
            <form className={styles.stepPane} onSubmit={continueWithEmail} noValidate>
              <h2 className={styles.stepTitle}>Sign in</h2>
              <div className={styles.fieldWrap}>
                <input
                  id={emailId}
                  className={styles.field}
                  type="email"
                  autoComplete="username"
                  autoFocus
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <label className={styles.label} htmlFor={emailId}>
                  Email
                </label>
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primary}>
                Continue
              </button>
              <div className={styles.altRow}>
                <a className={styles.sso} href={`${resolveApiBase()}/auth/sso/login`}>
                  Continue with SSO
                </a>
              </div>
            </form>
          )}

          {mode === 'signin' && signinStep === 'password' && (
            <form className={styles.stepPane} onSubmit={submitSignin}>
              <h2 className={styles.stepTitle}>Enter your password</h2>
              <div className={styles.accountChip}>
                <span className={styles.accountAvatar} aria-hidden>
                  {avatarLetter}
                </span>
                <span>{email.trim()}</span>
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={() => {
                    setSigninStep('email');
                    setPassword('');
                    resetErrors();
                  }}
                >
                  Edit
                </button>
              </div>
              <div className={styles.fieldWrap}>
                <input
                  id={passwordId}
                  className={styles.field}
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <label className={styles.label} htmlFor={passwordId}>
                  Password
                </label>
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primary} disabled={loading || !password}>
                {loading ? <span className={styles.spin} aria-hidden /> : null}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          {mode === 'signup' && signupStep === 'product' && (
            <form className={styles.stepPane} onSubmit={continueProduct}>
              <h2 className={styles.stepTitle}>Your product</h2>
              <div className={styles.fieldWrap}>
                <input
                  id="product-url"
                  className={styles.field}
                  type="text"
                  autoComplete="url"
                  autoFocus
                  required
                  placeholder="Product URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <label className={styles.label} htmlFor="product-url">
                  Product URL
                </label>
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primary}>
                Continue
              </button>
              <div className={styles.altRow}>
                <a className={styles.sso} href={`${resolveApiBase()}/auth/sso/login`}>
                  Continue with SSO
                </a>
              </div>
            </form>
          )}

          {mode === 'signup' && signupStep === 'account' && (
            <form className={styles.stepPane} onSubmit={submitSignup}>
              <h2 className={styles.stepTitle}>Create your account</h2>
              <div className={styles.accountChip}>
                <span className={styles.accountAvatar} aria-hidden>
                  {(host[0] || 'A').toUpperCase()}
                </span>
                <span>{host}</span>
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={() => {
                    setSignupStep('product');
                    resetErrors();
                  }}
                >
                  Edit
                </button>
              </div>

              <div className={styles.signupGrid}>
                <div className={styles.signupGrid2}>
                  <div className={styles.fieldWrap}>
                    <input
                      id="full_name"
                      className={styles.field}
                      type="text"
                      autoComplete="name"
                      placeholder="Name"
                      value={signup.full_name}
                      onChange={(e) => setSignup({ ...signup, full_name: e.target.value })}
                    />
                    <label className={styles.label} htmlFor="full_name">
                      Name
                    </label>
                  </div>
                  <div className={styles.fieldWrap}>
                    <input
                      id="tenant_name"
                      className={styles.field}
                      type="text"
                      required
                      placeholder="Company"
                      value={signup.tenant_name}
                      onChange={(e) => setSignup({ ...signup, tenant_name: e.target.value })}
                    />
                    <label className={styles.label} htmlFor="tenant_name">
                      Company
                    </label>
                  </div>
                </div>
                <div className={styles.fieldWrap}>
                  <input
                    id="signup-email"
                    className={styles.field}
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Email"
                    value={signup.email}
                    onChange={(e) => setSignup({ ...signup, email: e.target.value })}
                  />
                  <label className={styles.label} htmlFor="signup-email">
                    Email
                  </label>
                </div>
                <div className={styles.fieldWrap}>
                  <input
                    id="signup-password"
                    className={styles.field}
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    placeholder="Password"
                    value={signup.password}
                    onChange={(e) => setSignup({ ...signup, password: e.target.value })}
                  />
                  <label className={styles.label} htmlFor="signup-password">
                    Password
                  </label>
                </div>
              </div>

              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primary} disabled={loading}>
                {loading ? <span className={styles.spin} aria-hidden /> : null}
                {loading ? 'Creating…' : 'Create account'}
              </button>
              <p className={styles.fine}>
                By continuing you agree to the terms. We only crawl pages you point us at.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
