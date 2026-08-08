import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Eyebrow, PageTitle, TextLead } from '@/components/ui/Typography';

interface HeroStat {
  label: string;
  value: string | number;
  tone?: 'sky' | 'violet' | 'emerald' | 'amber';
}

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
  stats?: HeroStat[];
  className?: string;
}

export function PageHero({ eyebrow, title, description, actions, icon: Icon, stats, className }: PageHeroProps) {
  return (
    <section
      className={cn(
        'tahoe-hero relative overflow-hidden rounded-[var(--radius-liquid)] border border-white/[0.08] p-5 lg:p-6 space-y-5',
        className,
      )}
    >
      <div className="tahoe-hero-shine" aria-hidden />
      <div className="relative space-y-3">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4 min-w-0 max-w-2xl">
            {Icon && (
              <div className="tahoe-icon-badge shrink-0">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div className="space-y-2 min-w-0">
              <PageTitle>{title}</PageTitle>
              {description && <TextLead>{description}</TextLead>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className={cn('tahoe-stat-tile', stat.tone && `tahoe-stat-${stat.tone}`)}>
              <p className="tahoe-stat-value">{stat.value}</p>
              <p className="tahoe-stat-label mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
