'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BookOpenCheck, Compass, Megaphone, Radar, SearchCheck, ShieldCheck } from 'lucide-react';
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

const CAPABILITIES = [
  { icon: Compass, title: 'Auto-discovery', body: 'Point at a website or docs. Agents crawl, read and build the product profile for you.' },
  { icon: BookOpenCheck, title: 'Grounded answers', body: 'Every claim is checked against your own knowledge base and cited, so pitches stay true.' },
  { icon: Radar, title: 'Background agents', body: 'Research, outreach and proposals keep running after you close the tab.' },
  { icon: SearchCheck, title: 'SEO scoring', body: 'Audit pages and score drafts with checks computed from the content. Keyword data says whether it is measured or an estimate.' },
  { icon: ShieldCheck, title: 'Human-approved publishing', body: 'Nothing goes out unreviewed. Approval is tied to the exact content that gets published.' },
  { icon: Megaphone, title: 'Every channel', body: 'LinkedIn, X, Medium, Dev.to, Reddit, WordPress and email, with suppression built in.' },
];

const TRUST = ['Grounded', 'Human-approved', 'Multi-tenant', 'Runs on your hardware'];

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
        <ul className={styles.trustRow} aria-label="Highlights">
          {TRUST.map((t) => (
            <li key={t} className={styles.trustPill}>{t}</li>
          ))}
        </ul>
        <div className={styles.heroVisual}>
          <div className={styles.heroGlow} aria-hidden />
          <ShowcaseFrame
            image="/screenshots/workspace.png"
            alt="The Aurora workspace: a nine-stage GTM pipeline with a live run log"
            objectPosition="50% 20%"
          />
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

export function HomeCapabilities() {
  return (
    <Reveal>
      <section className={styles.capabilities} aria-labelledby="cap-title">
        <div className={styles.wrap}>
          <h2 id="cap-title" className={styles.hSec}>Everything between a URL and a published page.</h2>
          <RevealGroup className={styles.capGrid}>
            {CAPABILITIES.map(({ icon: Icon, title, body }) => (
              <article key={title} className={styles.capCard}>
                <span className={styles.capIcon}><Icon aria-hidden size={20} /></span>
                <h3 className={styles.capTitle}>{title}</h3>
                <p className={styles.capBody}>{body}</p>
              </article>
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
      <HomeCapabilities />
      <HomeShowcaseBands />
      <HomePipelineSection />
      <HomeInkCta />
    </>
  );
}
