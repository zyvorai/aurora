import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  Server,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Zyvor AI Labs — Open Infrastructure',
  description:
    'Open infrastructure without the lock-in. Modernize VMware, private cloud, Kubernetes, and AI infrastructure on your hardware, your cloud, or both.',
};

// This page is a deliberately distinct visual skin from the rest of the app's
// glass/Tahoe system — a warm, editorial/technical look, matching Zyvor's
// company-level marketing (not Emissary's own product identity). Scoped
// entirely to this file (local color constants, not new globals.css tokens).
const cream = '#F2EFE6';
const ink = '#1A1F1F';
const rust = '#C1503C';
const teal = '#1B3A47';

const navLink = 'text-sm font-medium hover:opacity-70 transition-opacity';
const ZYVOR = 'https://zyvor.dev';

const PATHS = [
  {
    index: '01',
    icon: Server,
    title: 'Exit VMware',
    description: 'Build a phased, low-risk path away from Broadcom dependency.',
    tag: 'VMware → KVM',
  },
  {
    index: '02',
    icon: Server,
    title: 'Build private cloud',
    description: 'Operate a flexible infrastructure platform on your hardware.',
    tag: 'Control → Scale',
  },
  {
    index: '03',
    icon: Server,
    title: 'Reduce cloud cost',
    description: 'Model a right-sized estate before the next renewal or migration.',
    tag: 'Calculate',
  },
];

export default function HomePage() {
  return (
    <div style={{ background: cream, color: ink }} className="min-h-screen font-sans">
      <nav
        className="sticky top-0 z-40 border-b"
        style={{ background: cream, borderColor: 'rgba(26,31,31,0.12)' }}
      >
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <a href={ZYVOR} className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 flex items-center justify-center rounded-md"
              style={{ background: ink }}
            >
              <span className="text-white font-black text-sm">Z</span>
            </div>
            <span className="font-black tracking-tight">
              ZYVOR <span className="font-mono text-xs font-normal opacity-60">AI LABS</span>
            </span>
          </a>
          <div className="hidden sm:flex items-center gap-8">
            <a href={ZYVOR} className={navLink}>Paths</a>
            <a href="#proof" className={navLink}>Proof</a>
            <a href={`${ZYVOR}/demo`} className={navLink}>Labs</a>
            <a href={ZYVOR} className={navLink}>Resources</a>
          </div>
          <a
            href={`${ZYVOR}/contact`}
            className="inline-flex items-center gap-2 px-4 py-2 border font-mono text-sm font-medium hover:opacity-70 transition-opacity"
            style={{ borderColor: ink }}
          >
            Talk to an Engineer
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="mx-auto max-w-6xl px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center"
        style={{
          backgroundImage: 'radial-gradient(rgba(26,31,31,0.08) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-6 font-mono text-xs tracking-wider" style={{ color: rust }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: rust }} />
            OPEN INFRASTRUCTURE / 001
          </div>
          <h1 className="font-black tracking-tight leading-[1.05] text-5xl mb-6">
            Open infrastructure.
            <br />
            <span style={{ color: rust }}>Without the lock-in.</span>
          </h1>
          <p className="text-lg mb-8 max-w-md" style={{ color: 'rgba(26,31,31,0.65)' }}>
            Modernize VMware, private cloud, Kubernetes and AI infrastructure using an open
            enterprise platform that runs on your hardware, your cloud, or both.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`${ZYVOR}/assessment`}
              className="inline-flex items-center gap-2 px-6 py-3.5 text-white font-mono text-sm font-medium"
              style={{ background: rust }}
            >
              Assess environment
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href={`${ZYVOR}/contact`}
              className="inline-flex items-center gap-2 px-6 py-3.5 border font-mono text-sm font-medium hover:opacity-70 transition-opacity"
              style={{ borderColor: ink }}
            >
              Talk to an Engineer
            </a>
          </div>
        </div>
        <div className="border p-6" style={{ borderColor: 'rgba(26,31,31,0.15)' }}>
          <div className="flex items-center justify-between mb-6 font-mono text-xs" style={{ color: 'rgba(26,31,31,0.5)' }}>
            <span>THE OPEN ROUTE</span>
            <span>45.421 / 73.567</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="border px-4 py-5 flex-1" style={{ borderColor: 'rgba(26,31,31,0.2)' }}>
              <div className="font-mono text-xs mb-2" style={{ color: 'rgba(26,31,31,0.5)' }}>LEGACY CONSTRAINT</div>
              <Server className="w-6 h-6" style={{ color: 'rgba(26,31,31,0.5)' }} aria-hidden />
            </div>
            <div className="flex-1 border-t-2 border-dotted h-0" style={{ borderColor: rust }} />
            <div className="px-4 py-5 flex-1 text-white" style={{ background: teal }}>
              <div className="font-mono text-xs mb-2 opacity-70">OPEN CONTROL</div>
              <Boxes className="w-6 h-6" aria-hidden />
            </div>
          </div>
        </div>
      </section>

      {/* Problem paths */}
      <section className="mx-auto max-w-6xl px-6 py-20 border-t" style={{ borderColor: 'rgba(26,31,31,0.12)' }}>
        <div className="font-mono text-xs tracking-wider mb-4" style={{ color: 'rgba(26,31,31,0.5)' }}>
          START WITH THE PROBLEM
        </div>
        <h2 className="font-black tracking-tight text-4xl mb-3">What are you trying to solve?</h2>
        <p className="text-lg mb-12" style={{ color: 'rgba(26,31,31,0.65)' }}>
          Choose a route. We&apos;ll show you the infrastructure path, not a product catalogue.
        </p>
        <div className="grid sm:grid-cols-3 gap-px" style={{ background: 'rgba(26,31,31,0.15)' }}>
          {PATHS.map((p) => (
            <a key={p.index} href={`${ZYVOR}/assessment`} style={{ background: cream }} className="p-6 block hover:opacity-90 transition-opacity">
              <div className="flex items-center justify-between mb-8">
                <span className="font-mono text-sm" style={{ color: rust }}>{p.index}</span>
                <p.icon className="w-5 h-5" style={{ color: teal }} aria-hidden />
              </div>
              <h3 className="font-bold text-xl mb-2">{p.title}</h3>
              <p className="text-sm mb-6" style={{ color: 'rgba(26,31,31,0.65)' }}>{p.description}</p>
              <span className="font-mono text-xs inline-flex items-center gap-1.5" style={{ color: ink }}>
                {p.tag} <ArrowRight className="w-3 h-3" />
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Technical proof */}
      <section id="proof" className="mx-auto max-w-6xl px-6 py-20 border-t grid lg:grid-cols-2 gap-12 items-center" style={{ borderColor: 'rgba(26,31,31,0.12)' }}>
        <div>
          <div className="font-mono text-xs tracking-wider mb-4" style={{ color: 'rgba(26,31,31,0.5)' }}>
            TECHNICAL PROOF / LIVE LABS
          </div>
          <h2 className="font-black tracking-tight text-4xl leading-[1.05] mb-3">
            Don&apos;t take our word for it.
            <br />
            <span style={{ color: rust }}>Test it.</span>
          </h2>
          <p className="text-lg" style={{ color: 'rgba(26,31,31,0.65)' }}>
            See how workloads move, networks map and platforms operate before you start a
            conversation.
          </p>
        </div>
        <div className="p-8 text-white" style={{ background: teal }}>
          <div className="font-mono text-xs opacity-60 mb-4">ZYVOR / LAB 07</div>
          <div className="font-mono text-sm mb-5">
            guestkit.inspect( <span style={{ color: rust }}>vm-742</span> )
          </div>
          <div className="font-mono text-xs space-y-2 opacity-90 mb-6">
            <div>→ disks discovered: 04</div>
            <div>→ blockers found: 02</div>
            <div>→ migration route: phased</div>
          </div>
          <a
            href={`${ZYVOR}/demo`}
            className="inline-flex items-center gap-2 px-4 py-2.5 font-mono text-sm font-medium"
            style={{ background: cream, color: ink }}
          >
            Launch a lab
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 border-t" style={{ borderColor: 'rgba(26,31,31,0.12)' }}>
        <div className="font-mono text-xs tracking-wider mb-4" style={{ color: 'rgba(26,31,31,0.5)' }}>
          YOUR NEXT INFRASTRUCTURE DECISION
        </div>
        <h2 className="font-black tracking-tight text-5xl leading-[1.05] mb-8">
          Make the next move
          <br />
          <span style={{ color: rust }}>with evidence.</span>
        </h2>
        <a
          href={`${ZYVOR}/assessment`}
          className="inline-flex items-center gap-2 px-6 py-3.5 text-white font-mono text-sm font-medium"
          style={{ background: rust }}
        >
          Get a free assessment
          <ArrowRight className="w-4 h-4" />
        </a>
      </section>

      <footer className="text-white" style={{ background: teal }}>
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center rounded-md" style={{ background: cream }}>
              <span style={{ color: teal }} className="font-black text-sm">Z</span>
            </div>
            <span className="font-black tracking-tight">ZYVOR AI LABS</span>
            <Link href="/login" className="ml-4 font-mono text-xs opacity-70 hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 border-l border-white/20 pl-4">
              <Sparkles className="w-3 h-3" aria-hidden />
              Already an Emissary customer? Sign in
            </Link>
          </div>
          <span className="font-mono text-xs opacity-60">OPEN INFRASTRUCTURE CONTROL PLANE / 2026</span>
        </div>
        {/* Reserve space so the fixed bottom-right CTA pill never overlaps footer text */}
        <div className="h-16 sm:h-0" aria-hidden />
      </footer>

      <a
        href={`${ZYVOR}/assessment`}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 px-4 py-3 text-white font-mono text-sm font-medium shadow-lg"
        style={{ background: rust }}
      >
        <span className="opacity-70">NEED A ROUTE?</span>
        Assess environment
        <ArrowRight className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
