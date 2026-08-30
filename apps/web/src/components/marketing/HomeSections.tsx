'use client';

import Link from 'next/link';
import { Reveal } from '@/components/ui/Reveal';
import styles from './marketing.module.css';

const PROOF = [
  { label: 'Specialized agents', value: '11' },
  { label: 'Implementation phases', value: '12' },
  { label: 'Documented test cases', value: '223' },
  { label: 'Multi-tenant', value: 'Built in' },
];

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
      <div className={`${styles.wrap} ${styles.heroInner}`}>
        <p className={styles.brandMark}>Aurora</p>
        <h1 className={styles.heroHeadline}>Turn your product into an AI salesperson.</h1>
        <p className={styles.lede}>
          Onboard from a website or docs. Build a grounded knowledge graph. Run marketing, sales, and
          solution agents — quietly, in the background.
        </p>
        <div className={styles.heroBtnrow}>
          <Link href="/login" className={styles.btnPrimary}>
            Get started
          </Link>
          <Link href="/features" className={styles.linkCta}>
            Learn more <span aria-hidden>›</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HomeProofBand() {
  return (
    <Reveal>
      <section className={styles.proofBand} aria-label="Platform proof points">
        <div className={styles.wrap}>
          <div className={styles.proofGrid}>
            {PROOF.map((s) => (
              <div key={s.label} className={styles.proofItem}>
                <div className={styles.proofValue}>{s.value}</div>
                <div className={styles.proofLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Reveal>
  );
}

export function HomeShowcaseBands() {
  return (
    <>
      {SHOWCASE.map((band) => (
        <Reveal key={band.title}>
          <section className={band.tint ? styles.showcaseTint : styles.showcase}>
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
        </Reveal>
      ))}
    </>
  );
}

export function HomePipelineSection() {
  return (
    <Reveal>
      <section className={`${styles.section} ${styles.sectionTint}`}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <h2 className={styles.hSec}>How it works</h2>
            <p className={styles.sectionLede}>
              From a URL to live GTM agents — one continuous chain.
            </p>
          </div>
          <div className={styles.pipelineList}>
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
  );
}

export function HomeInkCta() {
  return (
    <Reveal>
      <section className={styles.inkSection}>
        <div className={styles.wrap}>
          <h2 className={styles.inkHeadline}>Ready when you are.</h2>
          <p className={styles.inkLede}>
            Onboard your first product and generate a GTM strategy in minutes.
          </p>
          <Link href="/login" className={styles.btnPrimary}>
            Get started
          </Link>
        </div>
      </section>
    </Reveal>
  );
}

export function HomeSections() {
  return (
    <>
      <HomeHero />
      <HomeProofBand />
      <HomeShowcaseBands />
      <HomePipelineSection />
      <HomeInkCta />
    </>
  );
}
