import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './marketing.module.css';

const STATS = [
  { label: 'Specialized agents', value: '11' },
  { label: 'Implementation phases', value: '12' },
  { label: 'Documented test cases', value: '223' },
  { label: 'Multi-tenant', value: 'Built in' },
];

const PIPELINE_STEPS = [
  {
    step: 'Step 1',
    title: 'Discover',
    description: 'Point at a URL or docs — agents crawl and build a product profile automatically.',
  },
  {
    step: 'Step 2',
    title: 'Extract',
    description: 'A searchable knowledge graph and RAG store ground every downstream answer.',
  },
  {
    step: 'Step 3',
    title: 'Orchestrate',
    description: 'A supervisor routes work across dedicated Marketing, Sales, and Solution agents.',
  },
  {
    step: 'Step 4',
    title: 'Publish & learn',
    description: 'Omnichannel publishing and analytics close the loop, feeding continuous learning.',
  },
];

const SHOWCASE = [
  {
    title: 'Grounded in your product',
    lede: 'Every answer cites real knowledge — no hallucinated pitches.',
    href: '/features#grounded',
    tint: false,
  },
  {
    title: 'Runs in the background',
    lede: 'Long-running GTM work keeps going after you close the tab.',
    href: '/features#agents',
    tint: true,
  },
];

export function HomeHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>GTM Orchestration Platform</p>
        <h1 className={styles.heroHeadline}>
          Turn your product into
          <br />
          an AI-powered GTM engine
        </h1>
        <p className={styles.lede}>
          Aurora onboards from a website or docs, builds a grounded knowledge graph, then runs AI
          marketing, sales, and solution agents — enterprise-grade orchestration built for lean hardware.
        </p>
        <div className={styles.heroBtnrow}>
          <Link href="/login" className={styles.btnPrimary}>
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/features" className={styles.linkCta}>
            Explore features <span aria-hidden>›</span>
          </Link>
        </div>
        <p className={styles.heroNote}>No credit card required — onboard your first product in minutes</p>
      </div>
    </section>
  );
}

export function HomeStatsBand() {
  return (
    <section className={styles.statsBand}>
      <div className={styles.wrap}>
        <div className={styles.statsGrid}>
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-stat-value">{s.value}</div>
              <div className="text-stat-label mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeShowcaseBands() {
  return (
    <>
      {SHOWCASE.map((band) => (
        <section key={band.title} className={band.tint ? styles.showcaseTint : styles.showcase}>
          <div className={styles.wrap}>
            <div className={styles.showcaseInner}>
              <div className={styles.showcaseCopy}>
                <h2 className={styles.hSec}>{band.title}</h2>
                <p className={styles.sectionLede}>{band.lede}</p>
                <Link href={band.href} className={styles.linkCta}>
                  Learn more <span aria-hidden>›</span>
                </Link>
              </div>
              <div className={styles.showcaseVisual} aria-hidden />
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

export function HomePipelineSection() {
  return (
    <section className={styles.section}>
      <div className={styles.wrap}>
        <div className={styles.sectionHead}>
          <h2 className={styles.hSec}>How it works</h2>
          <p className={styles.sectionLede}>
            Customer sources → discovery → knowledge graph → agents → publishing → analytics
          </p>
        </div>
        <div className={styles.tilesGrid}>
          {PIPELINE_STEPS.map((step) => (
            <article key={step.title} className={styles.tile}>
              <p className={styles.tileStep}>{step.step}</p>
              <h3 className={styles.tileTitle}>{step.title}</h3>
              <p className={styles.tileBody}>{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeInkCta() {
  return (
    <section className={styles.inkSection}>
      <div className={styles.wrap}>
        <h2 className={styles.inkHeadline}>Ready to turn your product into a salesperson?</h2>
        <p className={styles.inkLede}>Onboard your first product and generate a GTM strategy in minutes.</p>
        <Link href="/login" className={styles.btnPrimary}>
          Get started free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export function HomeSections() {
  return (
    <>
      <HomeHero />
      <HomeStatsBand />
      <HomeShowcaseBands />
      <HomePipelineSection />
      <HomeInkCta />
    </>
  );
}
