import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  MessageSquare,
  Network,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Reveal } from '@/components/ui/Reveal';
import { TONE_ROTATION } from '@/lib/tone';
import { cn } from '@/lib/cn';
import {
  Eyebrow,
  DisplayTitle,
  SectionTitle,
  SubsectionTitle,
  Text,
  TextMuted,
  TextLead,
  Stat,
} from '@/components/ui/Typography';

export const metadata: Metadata = {
  title: 'Aurora — Features',
  description:
    'Turn your technical product into an AI-powered salesperson: auto-discovery, a grounded knowledge graph, and background marketing/sales/solution agents.',
};

const ctaPrimary =
  'inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 font-semibold text-white ' +
  'bg-primary border border-primary hover:bg-[var(--primary-hover)] transition-colors';

const ctaSecondary =
  'inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 font-semibold text-foreground ' +
  'border border-[var(--glass-border)] bg-[var(--glass-bg)] ' +
  'hover:border-[var(--glass-border-strong)] hover:bg-[var(--glass-bg-elevated)] transition-colors';

const STATS = [
  { label: 'Specialized agents', value: '11' },
  { label: 'Implementation phases', value: '12' },
  { label: 'Documented test cases', value: '223' },
  { label: 'Multi-tenant', value: 'Built in' },
];

const PIPELINE_STEPS = [
  {
    icon: Globe,
    title: 'Discover',
    description: 'Point at a URL or docs — agents crawl and build a product profile automatically.',
  },
  {
    icon: Network,
    title: 'Extract',
    description: 'A searchable knowledge graph and RAG store ground every downstream answer.',
  },
  {
    icon: Workflow,
    title: 'Orchestrate',
    description: 'A supervisor routes work across dedicated Marketing, Sales, and Solution agents.',
  },
  {
    icon: Send,
    title: 'Publish & learn',
    description: 'Omnichannel publishing and analytics close the loop, feeding continuous learning.',
  },
];

const CORE_FEATURES = [
  {
    icon: Globe,
    title: 'Auto-Discovery',
    description: 'Point at a URL — agents crawl and build a product profile automatically.',
  },
  {
    icon: Workflow,
    title: 'Background Agents',
    description: 'Outbound sprints, technical evals, and proposals run in the background — close the tab, they keep going.',
  },
  {
    icon: ShieldCheck,
    title: 'Grounded Answers',
    description: 'Every claim is cited against real product knowledge — no hallucinated pitches.',
  },
  {
    icon: Zap,
    title: 'Lean & Fast',
    description: 'Executive briefs load instantly, even before an agent has run.',
  },
  {
    icon: Send,
    title: 'Omnichannel Publishing',
    description: 'Push generated content to LinkedIn, X, Medium, Dev.to, Reddit, and email — suppression-aware.',
  },
  {
    icon: Users,
    title: 'Multi-Tenant Workspaces',
    description: 'Role-based landings route marketing, sales, and reseller users to the view they need.',
  },
];

const LLM_PROVIDERS = [
  {
    name: 'Ollama',
    badge: 'Dev default · free',
    description: 'Local, free inference — Llama, Qwen, DeepSeek, and Gemma routed per agent.',
    points: ['No API costs', 'Runs on your own hardware', 'nomic-embed-text embeddings (768d)'],
  },
  {
    name: 'OpenAI',
    badge: 'Production',
    description: 'GPT-4o / GPT-4o-mini per agent for production-grade quality.',
    points: ['Pay-per-token', 'text-embedding-3-small (1536d)', 'Switch with one env var'],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 backdrop-blur-xl backdrop-saturate-[1.8] bg-[var(--nav-bg)] border-b border-[var(--nav-border)]">
        <div className="mx-auto max-w-6xl px-6 h-11 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-primary flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" aria-hidden />
            </div>
            <span className="font-bold tracking-tight text-sm text-foreground">Aurora</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/login"
              className="text-sm font-medium text-muted hover:text-foreground rounded-[var(--radius-sm)] px-[11px] py-2 hover:bg-[var(--nav-hover-bg)] transition-colors"
            >
              Sign in
            </Link>
            <Link href="/login" className="ml-2 rounded-[var(--radius-pill)] bg-primary hover:bg-[var(--primary-hover)] text-white text-xs font-semibold px-[13px] py-1.5 transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <Eyebrow className="justify-center flex mb-4">GTM Orchestration Platform</Eyebrow>
        <DisplayTitle className="mb-5">
          Turn your product into
          <br />
          <span className="text-gradient-apple">an AI-powered GTM engine</span>
        </DisplayTitle>
        <TextLead className="mx-auto max-w-2xl mb-8">
          Aurora onboards from a website or docs, builds a grounded knowledge graph, then runs AI
          marketing, sales, and solution agents — enterprise-grade orchestration built for lean hardware.
        </TextLead>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className={ctaPrimary}>
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className={ctaSecondary}>
            Sign in
          </Link>
        </div>
        <TextMuted className="mt-4 text-body-sm">No credit card required — onboard your first product in minutes</TextMuted>
      </section>

      <section className="border-y border-border bg-[var(--glass-bg)]">
        <div className="mx-auto max-w-4xl px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {STATS.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} className="mx-auto" />
          ))}
        </div>
      </section>

      <Reveal>
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center mb-10">
            <SectionTitle as="h2" className="mb-2">How it works</SectionTitle>
            <TextMuted>Customer sources → discovery → knowledge graph → agents → publishing → analytics</TextMuted>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PIPELINE_STEPS.map((step, i) => {
              const toneKey = TONE_ROTATION[i % TONE_ROTATION.length];
              return (
                <Card key={step.title} hover className={cn('p-5 relative tahoe-card-edge', `tahoe-card-edge-${toneKey}`)}>
                  <div className={cn('tahoe-glyph-tile mb-4', `tahoe-glyph-tile-${toneKey}`)}>
                    <step.icon className="h-5 w-5" />
                  </div>
                  <Badge className="mb-2">Step {i + 1}</Badge>
                  <SubsectionTitle className="mb-1.5">{step.title}</SubsectionTitle>
                  <TextMuted className="text-body-sm">{step.description}</TextMuted>
                </Card>
              );
            })}
          </div>
        </section>
      </Reveal>

      <Reveal>
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <Eyebrow className="mb-3">Grounded in your product</Eyebrow>
            <SectionTitle as="h2" className="mb-4 text-2xl md:text-[1.75rem]">
              Every answer cites real product knowledge
            </SectionTitle>
            <TextMuted className="mb-6 leading-relaxed">
              Sales chat and Q&amp;A run against your knowledge graph, not a generic model's guess.
              No hallucinated pitches — every claim traces back to a source.
            </TextMuted>
            <ul className="space-y-3">
              {[
                'Answers are cited against ingested docs and crawled pages',
                'A citation gate blocks ungrounded claims before they reach a prospect',
                'Same knowledge graph powers Sales, Solution Architect, and Marketing agents',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-primary" aria-hidden />
                  <Text className="text-body-sm">{point}</Text>
                </li>
              ))}
            </ul>
          </div>
          <Card elevated className="p-5">
            <div className="flex items-center gap-2 mb-4 text-body-sm text-muted">
              <MessageSquare className="h-4 w-4" aria-hidden />
              Sales Chat
            </div>
            <div className="space-y-3">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-surface px-4 py-2.5 text-body-sm">
                What's included in the enterprise tier?
              </div>
              <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-[var(--glass-bg-elevated)] border border-[var(--glass-border)] px-4 py-3 space-y-2">
                <Text className="text-body-sm">
                  Enterprise includes SSO, multi-tenant workspaces, and priority support.
                </Text>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />
                  <span className="text-xs text-primary">pricing.md · docs/enterprise</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Card elevated className="p-5 order-2 lg:order-1">
            <div className="flex items-center gap-2 mb-4 text-body-sm text-muted">
              <Workflow className="h-4 w-4" aria-hidden />
              Background agents
            </div>
            <div className="space-y-4">
              {[
                { name: 'Outbound sprint — TechCorp', percent: 72, status: 'Running' as const },
                { name: 'Technical eval — DataFlow', percent: 100, status: 'Done' as const },
                { name: 'Proposal draft — Acme', percent: 35, status: 'Running' as const },
              ].map((task) => (
                <div key={task.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-body-sm">{task.name}</span>
                    <Badge variant={task.status === 'Done' ? 'success' : 'default'}>
                      {task.status === 'Done' ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden />
                      ) : (
                        <Clock className="h-3 w-3 mr-1" aria-hidden />
                      )}
                      {task.status}
                    </Badge>
                  </div>
                  <ProgressBar percent={task.percent} showPercent={false} />
                </div>
              ))}
            </div>
          </Card>
          <div className="order-1 lg:order-2">
            <Eyebrow className="mb-3">Runs in the background</Eyebrow>
            <SectionTitle as="h2" className="mb-4 text-2xl md:text-[1.75rem]">
              Long-running work doesn't block your UI
            </SectionTitle>
            <TextMuted className="mb-6 leading-relaxed">
              Outbound sprints, technical evaluations, and proposal drafts run as background agent
              tasks — check in whenever you want, keep working in the meantime.
            </TextMuted>
            <ul className="space-y-3">
              {[
                'Agent Task Progress panel tracks every in-flight job',
                'Executive briefs stay SQL-first and instant — LLM calls only run when triggered',
                'A supervisor coordinates Marketing, Sales, and Solution agents behind the scenes',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-primary" aria-hidden />
                  <Text className="text-body-sm">{point}</Text>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center mb-10">
          <SectionTitle as="h2" className="mb-2">Built for real GTM work</SectionTitle>
          <TextMuted>Every capability is grounded in your actual product — nothing generated blind.</TextMuted>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CORE_FEATURES.map((f, i) => {
            const toneKey = TONE_ROTATION[i % TONE_ROTATION.length];
            return (
              <Card key={f.title} hover className={cn('p-5 tahoe-card-edge', `tahoe-card-edge-${toneKey}`)}>
                <div className={cn('tahoe-glyph-tile mb-4', `tahoe-glyph-tile-${toneKey}`)}>
                  <f.icon className="h-5 w-5" />
                </div>
                <SubsectionTitle className="mb-1.5">{f.title}</SubsectionTitle>
                <TextMuted className="text-body-sm">{f.description}</TextMuted>
              </Card>
            );
          })}
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center mb-10">
          <SectionTitle as="h2" className="mb-2">Bring your own LLM</SectionTitle>
          <TextMuted>One provider factory, switched entirely by environment variable.</TextMuted>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {LLM_PROVIDERS.map((p) => (
            <Card key={p.name} elevated className="p-6">
              <div className="flex items-center justify-between mb-3">
                <SubsectionTitle>{p.name}</SubsectionTitle>
                <Badge variant="success">{p.badge}</Badge>
              </div>
              <Text className="text-body-sm mb-4">{p.description}</Text>
              <ul className="space-y-2">
                {p.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-body-sm text-muted">
                    <BarChart3 className="h-4 w-4 mt-0.5 shrink-0 text-primary" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <SectionTitle as="h2" className="mb-3">Ready to turn your product into a salesperson?</SectionTitle>
        <TextMuted className="mb-8">Onboard your first product and generate a GTM strategy in minutes.</TextMuted>
        <Link href="/login" className={ctaPrimary}>
          Get started free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
      </Reveal>

      <footer className="bg-[var(--glass-bg-strong)] border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" aria-hidden />
              </div>
              <span className="font-bold text-foreground text-body-sm">Aurora</span>
            </div>
            <TextMuted className="text-body-sm">GTM Orchestration Platform</TextMuted>
          </div>
          <div>
            <SubsectionTitle className="text-body-sm mb-3">Product</SubsectionTitle>
            <ul className="space-y-2">
              <li><Link href="/features" className="text-body-sm text-muted hover:text-foreground transition-colors">Features</Link></li>
              <li><Link href="/login" className="text-body-sm text-muted hover:text-foreground transition-colors">Get started</Link></li>
            </ul>
          </div>
          <div>
            <SubsectionTitle className="text-body-sm mb-3">Account</SubsectionTitle>
            <ul className="space-y-2">
              <li><Link href="/login" className="text-body-sm text-muted hover:text-foreground transition-colors">Sign in</Link></li>
              <li><Link href="/login" className="text-body-sm text-muted hover:text-foreground transition-colors">Create workspace</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-5">
            <span className="text-body-sm text-muted">© {new Date().getFullYear()} Aurora</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
