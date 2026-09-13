import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Eyebrow, PageTitle, TextLead } from '@/components/ui/Typography';

export type Tone = 'sky' | 'violet' | 'emerald' | 'amber' | 'pink' | 'teal' | 'rust';

interface HeroStat {
  label: string;
  value: string | number;
  tone?: Tone;
}

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  accent?: Tone;
  stats?: HeroStat[];
  className?: string;
  /** display = larger store-style headline (dashboard, marketing-adjacent pages) */
  variant?: 'default' | 'display';
}

export function PageHero({ eyebrow, title, description, actions, stats, className, variant = 'default' }: PageHeroProps) {
  return (
    <section className={cn('panel-flat space-y-5', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5 min-w-0 max-w-2xl">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          {variant === 'display' ? (
            <h1 className="text-[clamp(2rem,4.5vw,3rem)] font-semibold tracking-[-0.04em] leading-[1.05] text-foreground">
              {title}
            </h1>
          ) : (
            <PageTitle className="tracking-[-0.03em]">{title}</PageTitle>
          )}
          {description && (
            <TextLead className="text-[17px] leading-[1.47] tracking-[-0.01em] max-w-[42ch]">{description}</TextLead>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>

      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-border">
          {stats.map((stat) => (
            <div key={stat.label} className="hero-stat-tile">
              <p className="hero-stat-value">{stat.value}</p>
              <p className="hero-stat-label mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
