import { Reveal, RevealGroup } from '@/components/ui/Reveal';
import styles from './marketing.module.css';

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

export function PipelineSteps({ id, innerId }: { id?: string; innerId?: string }) {
  return (
    <Reveal>
      <section id={id} className={`${styles.section} ${styles.sectionTint}`}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <h2 className={styles.hSec}>How it works</h2>
            <p className={styles.sectionLede}>
              From a URL to live GTM agents — one continuous chain.
            </p>
          </div>
          <RevealGroup id={innerId} className={styles.pipelineList}>
            {PIPELINE_STEPS.map((step) => (
              <article key={step.title} className={styles.pipelineStep}>
                <p className={styles.tileStep}>{step.step}</p>
                <h3 className={styles.tileTitle}>{step.title}</h3>
                <p className={styles.tileBody}>{step.description}</p>
              </article>
            ))}
          </RevealGroup>
        </div>
      </section>
    </Reveal>
  );
}
