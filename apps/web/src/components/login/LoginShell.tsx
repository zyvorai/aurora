'use client';

import { type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

export interface LoginOrb {
  hue: 'blue' | 'violet' | 'cyan' | 'indigo';
  size: number;
  top: string;
  left: string;
  duration: string;
  delay: string;
}

export interface LoginFeature {
  icon: ReactNode;
  gradient: string;
  glow: string;
  title: string;
  description: string;
}

const DEFAULT_ORBS: LoginOrb[] = [
  { hue: 'blue', size: 340, top: '4%', left: '6%', duration: '11s', delay: '0s' },
  { hue: 'violet', size: 220, top: '55%', left: '12%', duration: '13s', delay: '2.2s' },
  { hue: 'cyan', size: 180, top: '18%', left: '58%', duration: '9s', delay: '0.8s' },
  { hue: 'indigo', size: 300, top: '58%', left: '68%', duration: '15s', delay: '3.2s' },
];

/** 28 decorative particles -- mounted for structural parity with hyper2kvm's real
 * component tree, hidden via .login-particles{display:none} to match the macOS
 * variant's actual rendered behavior (not just visually absent, literally hidden). */
const PARTICLE_COUNT = 28;
const PARTICLE_DELAYS = [0, 0.45, 0.9, 1.35, 1.8, 2.25, 2.7];

interface LoginShellProps {
  logo: ReactNode;
  productName: string;
  productSubtitle: string;
  heroHeadline: ReactNode;
  heroSubheadline: string;
  pills: { icon?: ReactNode; label: string }[];
  features: LoginFeature[];
  heroFooter: ReactNode;
  mobileSubtitle: string;
  panelTitle: string;
  panelSubtitle: string;
  footer: ReactNode;
  orbs?: LoginOrb[];
  children: ReactNode;
}

export function LoginShell({
  logo,
  productName,
  productSubtitle,
  heroHeadline,
  heroSubheadline,
  pills,
  features,
  heroFooter,
  mobileSubtitle,
  panelTitle,
  panelSubtitle,
  footer,
  orbs = DEFAULT_ORBS,
  children,
}: LoginShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="login-page flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        <aside className="login-hero hidden lg:flex lg:w-[55%] flex-col justify-between p-10 xl:p-12 overflow-hidden relative">
          <div className="login-hero-mesh" aria-hidden />
          <div className="login-spotlight" aria-hidden />

          {orbs.map((orb, i) => (
            <div
              key={i}
              className={`login-orb login-orb-${orb.hue}`}
              style={{
                width: orb.size,
                height: orb.size,
                top: orb.top,
                left: orb.left,
                ['--login-delay' as string]: orb.delay,
                ['--login-duration' as string]: orb.duration,
              }}
            />
          ))}

          <div className="login-particles" aria-hidden>
            {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
              <span
                key={i}
                className="login-particle"
                style={{
                  left: `${(i * 37) % 100}%`,
                  top: `${(i * 53) % 100}%`,
                  width: 2 + (i % 3),
                  height: 2 + (i % 3),
                  animationDelay: `${PARTICLE_DELAYS[i % PARTICLE_DELAYS.length]}s`,
                }}
              />
            ))}
          </div>

          <div className="relative z-10">
            <div className="login-fade-in flex items-center gap-4 mb-8">
              <div className="login-logo-ring">{logo}</div>
              <div>
                <span className="text-4xl font-bold tracking-tight text-white block">{productName}</span>
                <span className="text-xs font-medium uppercase tracking-[0.28em] text-sky-300/80 mt-0.5 block">
                  {productSubtitle}
                </span>
              </div>
            </div>

            <h2 className="login-fade-in login-fade-in-d1 text-4xl xl:text-[2.75rem] font-extrabold text-white leading-[1.08] mb-4 max-w-xl">
              {heroHeadline}
            </h2>

            <p className="login-fade-in login-fade-in-d2 text-lg text-slate-300/90 max-w-lg leading-relaxed">
              {heroSubheadline}
            </p>

            <div className="login-fade-in login-fade-in-d3 flex flex-wrap gap-2 mt-6">
              {pills.map((pill) => (
                <span key={pill.label} className="login-stat-pill">
                  {pill.icon}
                  {pill.label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative z-10 space-y-2.5 max-h-[42vh] overflow-y-auto login-feature-scroll pr-1">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="login-feature-card login-fade-in flex items-start gap-4 p-4 rounded-xl backdrop-blur-md bg-white/[0.04] border border-white/10"
                style={{ animationDelay: `${0.35 + i * 0.07}s`, opacity: 0 }}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br ${f.gradient} shadow-lg ${f.glow}`}
                >
                  {f.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{f.title}</div>
                  <p className="text-xs mt-1 text-slate-400 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative z-10 login-fade-in login-fade-in-d4">{heroFooter}</div>
        </aside>

        <div className="login-beam hidden lg:block login-beam-w55" aria-hidden />

        <main className="login-panel flex-1 flex items-center justify-center relative px-6 py-12 min-h-screen lg:min-h-0">
          <div className="login-panel-grid" aria-hidden />
          <div className="login-panel-glow" aria-hidden />
          <div className="w-full max-w-[420px] relative z-10">
            <div className="lg:hidden text-center mb-8">
              <div className="login-logo-ring inline-block mb-4">{logo}</div>
              <h1 className="text-2xl font-bold text-white">{productName}</h1>
              <p className="text-sm mt-1 text-slate-400">{mobileSubtitle}</p>
            </div>

            <div className="hidden lg:block mb-8">
              <h2 className="text-2xl font-bold mb-1 text-white">{panelTitle}</h2>
              <p className="text-sm text-slate-400">{panelSubtitle}</p>
            </div>

            <div className="login-glass login-glass-border rounded-2xl p-8 shadow-2xl">{children}</div>

            <div className="mt-6 text-center">{footer}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function LoginError({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2.5 bg-red-950/50 border border-red-500/40 rounded-xl p-3 mb-6 login-shake"
      role="alert"
    >
      <AlertCircle className="h-4 w-4 text-red-400 shrink-0" aria-hidden />
      <span className="text-sm text-red-300">{message}</span>
    </div>
  );
}

interface LoginFieldProps {
  id: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
}

export function LoginField({ id, label, icon, children }: LoginFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>
      <div className="relative group">
        {icon}
        {children}
      </div>
    </div>
  );
}
