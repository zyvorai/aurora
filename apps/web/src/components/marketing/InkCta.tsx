import { Reveal } from '@/components/ui/Reveal';
import { MarketingBottomCta } from '@/components/marketing/MarketingHeroActions';
import styles from './marketing.module.css';

export function InkCta({
  headline = 'Ready when you are.',
  lede = 'Onboard your first product and generate a GTM strategy in minutes.',
}: {
  headline?: string;
  lede?: string;
}) {
  return (
    <Reveal>
      <section className={styles.inkSection}>
        <div className={styles.wrap}>
          <h2 className={styles.inkHeadline}>{headline}</h2>
          <p className={styles.inkLede}>{lede}</p>
          <MarketingBottomCta />
        </div>
      </section>
    </Reveal>
  );
}
