'use client';

import { type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

export interface LoginFeature {
  icon: ReactNode;
  title: string;
  description: string;
}

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
  children,
}: LoginShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="login-page flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        <aside className="login-hero hidden lg:flex lg:w-[55%] flex-col justify-between p-8 xl:p-10 overflow-hidden relative">
          <div className="login-hero-mesh" aria-hidden />

          <div className="relative z-10">
            <div className="login-fade-in flex items-center gap-3 mb-6">
              <div className="login-logo-ring">{logo}</div>
              <div>
                <span className="text-3xl font-bold tracking-tight text-white block">{productName}</span>
                <span className="text-xs font-medium uppercase tracking-[0.28em] text-[#F2EFE6]/55 mt-0.5 block">
                  {productSubtitle}
                </span>
              </div>
            </div>

            <h2 className="login-fade-in login-fade-in-d1 text-3xl xl:text-4xl font-extrabold text-white leading-[1.1] mb-3 max-w-xl">
              {heroHeadline}
            </h2>

            <p className="login-fade-in login-fade-in-d2 text-base text-[#F2EFE6]/70 max-w-lg leading-relaxed">
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
                className="login-feature-card login-fade-in flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10"
                style={{ animationDelay: `${0.35 + i * 0.07}s`, opacity: 0 }}
              >
                <div className="login-feature-icon w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                  {f.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{f.title}</div>
                  <p className="text-xs mt-1 text-[#F2EFE6]/50 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative z-10 login-fade-in login-fade-in-d4">{heroFooter}</div>
        </aside>

        <main className="login-panel flex-1 flex items-center justify-center relative px-6 py-12 min-h-screen lg:min-h-0">
          <div className="login-panel-grid" aria-hidden />
          <div className="w-full max-w-[360px] relative z-10">
            <div className="lg:hidden text-center mb-6">
              <div className="login-logo-ring inline-block mb-3">{logo}</div>
              <h1 className="text-xl font-bold text-[#1A1F1F]">{productName}</h1>
              <p className="text-sm mt-1 text-[#1A1F1F]/55">{mobileSubtitle}</p>
            </div>

            <div className="hidden lg:block mb-6">
              <h2 className="text-xl font-bold mb-1 text-[#1A1F1F]">{panelTitle}</h2>
              <p className="text-sm text-[#1A1F1F]/55">{panelSubtitle}</p>
            </div>

            <div className="login-glass rounded-2xl p-6">{children}</div>

            <div className="mt-5 text-center">{footer}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function LoginError({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2.5 bg-[#FDECEA] border border-[#F3B4AC] rounded-xl p-3 mb-6 login-shake"
      role="alert"
    >
      <AlertCircle className="h-4 w-4 text-[#B23A2A] shrink-0" aria-hidden />
      <span className="text-sm text-[#B23A2A]">{message}</span>
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
      <label htmlFor={id} className="block text-sm font-medium text-[#1A1F1F]/70 mb-2">
        {label}
      </label>
      <div className="relative group">
        {icon}
        {children}
      </div>
    </div>
  );
}
