import type { Metadata } from 'next';
import Image from 'next/image';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { MarketingHeroActions } from '@/components/marketing/MarketingHeroActions';
import { PipelineSteps } from '@/components/marketing/PipelineSteps';
import { InkCta } from '@/components/marketing/InkCta';
import { Reveal } from '@/components/ui/Reveal';
import styles from '@/components/marketing/marketing.module.css';

export const metadata: Metadata = {
  title: 'Aurora — Features',
  description:
    'Turn your technical product into an AI-powered salesperson: auto-discovery, a grounded knowledge graph, and background marketing/sales/solution agents.',
};

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

      <PipelineSteps id="discover" innerId="orchestrate" />

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
              <div className={styles.demoPanel}>
                <Image
                  src="/screenshots/brief.png"
                  alt="Executive Brief — real product metrics computed from ingested sources, not a generic model's guess"
                  fill
                  sizes="(min-width: 900px) 50vw, 100vw"
                  className={styles.demoPanelImage}
                  style={{ objectPosition: '50% 55%' }}
                />
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="agents" className={styles.featureBandAlt}>
          <div className={styles.wrap}>
            <div className={styles.featureSplit}>
              <div className={styles.demoPanel}>
                <Image
                  src="/screenshots/workspace.png"
                  alt="Workspace run log — a background agent job (build_profile) completed while the pipeline rail continues to the next stage"
                  fill
                  sizes="(min-width: 900px) 50vw, 100vw"
                  className={styles.demoPanelImage}
                  style={{ objectPosition: '85% 20%' }}
                />
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

      <InkCta />
    </MarketingLayout>
  );
}
