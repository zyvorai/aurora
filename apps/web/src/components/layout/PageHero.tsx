import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Eyebrow, PageTitle, TextLead } from '@/components/ui/Typography';

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHero({ eyebrow, title, description, actions, className }: PageHeroProps) {
  return (
    <section className={cn('space-y-3 pb-2', className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 max-w-2xl">
          <PageTitle>{title}</PageTitle>
          {description && <TextLead>{description}</TextLead>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
    </section>
  );
}
