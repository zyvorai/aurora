'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Reveal, RevealGroup } from '@/components/ui/Reveal';
import { MarketingHeroActions } from '@/components/marketing/MarketingHeroActions';
import { PipelineSteps } from '@/components/marketing/PipelineSteps';
import { InkCta } from '@/components/marketing/InkCta';
import styles from './marketing.module.css';

const PROOF = [
  { label: 'Specialized agents', value: '11' },
  { label: 'Implementation phases', value: '12' },
  { label: 'Documented test cases', value: '223' },
  { label: 'Multi-tenant', value: 'Built in' },
];

const SHOWCASE = [
  {
    title: 'Grounded in your product',
    lede: 'Every answer cites real knowledge — no hallucinated pitches.',
    href: '/features#grounded',
    tint: false,
    image: '/screenshots/brief.png',
    imageAlt:
      'Executive Brief — accounts, qualified leads, conversations, and GTM readiness, computed without an LLM call',
    objectPosition: '50% 30%',
  },
  {
    title: 'Runs in the background',
    lede: 'Long-running GTM work keeps going after you close the tab.',
    href: '/features#agents',
    tint: true,
    image: '/screenshots/workspace.png',
    imageAlt: 'Full Forge workspace — the 9-stage GTM pipeline with the run log dock showing a completed background job',
    objectPosition: '60% 20%',
  },
];

function ShowcaseFrame({ image, alt, objectPosition }: { image: string; alt: string; objectPosition: string }) {
  return (
    <div className={styles.showcaseVisual}>
      <div className={styles.productFrame}>
        <div className={styles.productFrameChrome}>
          <span className={styles.productFrameDot} />
          <span className={styles.productFrameDot} />
          <span className={styles.productFrameDot} />
        </div>
        <div className={styles.productFrameBody}>
          <Image
            src={image}
            alt={alt}
            fill
            sizes="(min-width: 900px) 50vw, 100vw"
            className={styles.productFrameImage}
            style={{ objectPosition }}
          />
        </div>
      </div>
    </div>
  );
}

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
        <MarketingHeroActions variant="home" />
      </div>
    </section>
  );
}

export function HomeProofBand() {
  return (
    <Reveal>
      <section className={styles.proofBand} aria-label="Platform proof points">
        <div className={styles.wrap}>
          <RevealGroup className={styles.proofGrid}>
            {PROOF.map((s) => (
              <div key={s.label} className={styles.proofItem}>
                <div className={styles.proofValue}>{s.value}</div>
                <div className={styles.proofLabel}>{s.label}</div>
              </div>
            ))}
          </RevealGroup>
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
                <ShowcaseFrame image={band.image} alt={band.imageAlt} objectPosition={band.objectPosition} />
              </div>
            </div>
          </section>
        </Reveal>
      ))}
    </>
  );
}

export function HomePipelineSection() {
  return <PipelineSteps />;
}

export function HomeInkCta() {
  return <InkCta />;
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
