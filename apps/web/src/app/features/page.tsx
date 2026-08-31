import type { Metadata } from 'next';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { MarketingBottomCta, MarketingHeroActions } from '@/components/marketing/MarketingHeroActions';
import { Reveal } from '@/components/ui/Reveal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import styles from '@/components/marketing/marketing.module.css';

export const metadata: Metadata = {
  title: 'Aurora — Features',
  description:
    'Turn your technical product into an AI-powered salesperson: auto-discovery, a grounded knowledge graph, and background marketing/sales/solution agents.',
};

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'Discover',
    description: 'Point at a URL or docs — agents crawl and build a product profile automatically.',
  },
  {
    step: '02',
    title: 'Extract',
    description: 'A searchable knowledge graph and RAG store ground every downstream answer.',
  },
  {
    step: '03',
    title: 'Orchestrate',
    description: 'A supervisor routes work across dedicated Marketing, Sales, and Solution agents.',
  },
  {
    step: '04',
    title: 'Publish & learn',
    description: 'Omnichannel publishing and analytics close the loop, feeding continuous learning.',
  },
];

const CORE_FEATURES = [
  {
    title: 'Auto-Discovery',
    description: 'Point at a URL — agents crawl and build a product profile automatically.',
  },
  {
    title: 'Background Agents',
    description: 'Outbound sprints, technical evals, and proposals keep running after you close the tab.',
  },
  {
    title: 'Grounded Answers',
    description: 'Every claim is cited against real product knowledge — no hallucinated pitches.',
  },
  {
    title: 'Lean & Fast',
    description: 'Executive briefs load instantly, even before an agent has run.',
  },
  {
    title: 'Omnichannel Publishing',
    description: 'Push content to LinkedIn, X, Medium, Dev.to, Reddit, and email — suppression-aware.',
  },
  {
    title: 'Multi-Tenant Workspaces',
    description: 'Role-based landings route marketing, sales, and reseller users to the view they need.',
  },
];

const LLM_PROVIDERS = [
  {
    name: 'Ollama',
    badge: 'Dev default · free',
    description: 'Local inference — Llama, Qwen, DeepSeek, and Gemma routed per agent.',
    points: ['No API costs', 'Runs on your hardware', 'nomic-embed-text embeddings'],
  },
  {
    name: 'OpenAI',
    badge: 'Production',
    description: 'GPT-4o / GPT-4o-mini per agent for production-grade quality.',
    points: ['Pay-per-token', 'text-embedding-3-small', 'Switch with one env var'],
  },
];

const GROUNDED_POINTS = [
  'Answers are cited against ingested docs and crawled pages',
  'A citation gate blocks ungrounded claims before they reach a prospect',
  'Same knowledge graph powers Sales, Solution, and Marketing agents',
];

const AGENT_POINTS = [
  'Progress panel tracks every in-flight job',
  'Executive briefs stay SQL-first and instant',
  'A supervisor coordinates Marketing, Sales, and Solution agents',
];

export default function FeaturesPage() {
  return (
    <MarketingLayout>
      <section className={styles.featuresHero}>
        <div className={`${styles.wrap} ${styles.heroInner}`}>
          <p className={styles.brandMark}>Aurora</p>
          <h1 className={styles.heroHeadline}>Built for real GTM work.</h1>
          <p className={styles.lede}>
            Auto-discovery, a grounded knowledge graph, and background agents — enterprise
            orchestration on lean hardware.
          </p>
          <MarketingHeroActions variant="features" />
        </div>
      </section>

      <Reveal>
        <section id="discover" className={`${styles.section} ${styles.sectionTint}`}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <h2 className={styles.hSec}>How it works</h2>
              <p className={styles.sectionLede}>From a URL to live GTM agents — one continuous chain.</p>
            </div>
            <div id="orchestrate" className={styles.pipelineList}>
              {PIPELINE_STEPS.map((step) => (
                <article key={step.title} className={styles.pipelineStep}>
                  <p className={styles.tileStep}>{step.step}</p>
                  <h3 className={styles.tileTitle}>{step.title}</h3>
                  <p className={styles.tileBody}>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="grounded" className={styles.featureBand}>
          <div className={styles.wrap}>
            <div className={styles.featureSplit}>
              <div>
                <h2 className={styles.hSec}>Every answer cites real product knowledge</h2>
                <p className={styles.sectionLede}>
                  Sales chat and Q&amp;A run against your knowledge graph, not a generic model&apos;s
                  guess.
                </p>
                <ul className={styles.featureList}>
                  {GROUNDED_POINTS.map((point) => (
                    <li key={point}>
                      <span className={styles.featureListMark} aria-hidden>
                        ›
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.demoPanel} aria-hidden>
                <p className={styles.proofLabel} style={{ marginBottom: 16 }}>
                  Sales Chat
                </p>
                <div
                  style={{
                    marginLeft: 'auto',
                    maxWidth: '85%',
                    borderRadius: 18,
                    borderTopRightRadius: 4,
                    background: 'var(--hs-bg-alt)',
                    padding: '10px 16px',
                    fontSize: 14,
                    marginBottom: 12,
                  }}
                >
                  What&apos;s included in the enterprise tier?
                </div>
                <div
                  style={{
                    maxWidth: '90%',
                    borderRadius: 18,
                    borderTopLeftRadius: 4,
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--hs-border)',
                    padding: '12px 16px',
                    fontSize: 14,
                    lineHeight: 1.47,
                  }}
                >
                  Enterprise includes SSO, multi-tenant workspaces, and priority support.
                  <div className="mt-2 text-xs text-primary">
                    pricing.md · docs/enterprise
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="agents" className={styles.featureBandAlt}>
          <div className={styles.wrap}>
            <div className={styles.featureSplit}>
              <div className={styles.demoPanel} aria-hidden>
                <p className={styles.proofLabel} style={{ marginBottom: 16 }}>
                  Background agents
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { name: 'Outbound sprint — TechCorp', percent: 72 },
                    { name: 'Technical eval — DataFlow', percent: 100 },
                    { name: 'Proposal draft — Acme', percent: 35 },
                  ].map((task) => (
                    <div key={task.name}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                          fontSize: 14,
                        }}
                      >
                        <span>{task.name}</span>
                        <span style={{ color: 'var(--hs-text-subtle)' }}>{task.percent}%</span>
                      </div>
                      <ProgressBar percent={task.percent} showPercent={false} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 className={styles.hSec}>Long-running work doesn&apos;t block your UI</h2>
                <p className={styles.sectionLede}>
                  Outbound sprints, technical evaluations, and proposal drafts run as background
                  agent tasks.
                </p>
                <ul className={styles.featureList}>
                  {AGENT_POINTS.map((point) => (
                    <li key={point}>
                      <span className={styles.featureListMark} aria-hidden>
                        ›
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="publish" className={styles.featureBand}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <h2 className={styles.hSec}>Capabilities</h2>
              <p className={styles.sectionLede}>
                Everything grounded in your actual product — nothing generated blind.
              </p>
            </div>
            <div className={styles.capabilityGrid}>
              {CORE_FEATURES.map((f) => (
                <article key={f.title} className={styles.capabilityItem}>
                  <h3 className={styles.capabilityTitle}>{f.title}</h3>
                  <p className={styles.capabilityBody}>{f.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="llm" className={styles.featureBandAlt}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <h2 className={styles.hSec}>Bring your own LLM</h2>
              <p className={styles.sectionLede}>One provider factory, switched by environment variable.</p>
            </div>
            <div className={styles.llmGrid}>
              {LLM_PROVIDERS.map((p) => (
                <article key={p.name} className={styles.llmItem}>
                  <h3 className={styles.llmName}>{p.name}</h3>
                  <p className={styles.llmBadge}>{p.badge}</p>
                  <p className={styles.capabilityBody} style={{ marginBottom: 12 }}>
                    {p.description}
                  </p>
                  <ul className={styles.featureList}>
                    {p.points.map((point) => (
                      <li key={point}>
                        <span className={styles.featureListMark} aria-hidden>
                          ›
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className={styles.inkSection}>
          <div className={styles.wrap}>
            <h2 className={styles.inkHeadline}>Ready when you are.</h2>
            <p className={styles.inkLede}>
              Onboard your first product and generate a GTM strategy in minutes.
            </p>
            <MarketingBottomCta />
          </div>
        </section>
      </Reveal>
    </MarketingLayout>
  );
}
