'use client';

import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/cn';
import { TONE_CLASSES } from '@/lib/tone';
import type { Tone } from '@/components/layout/PageHero';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  tone?: Tone;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actions, tone, className }: EmptyStateProps) {
  const toneClasses = tone ? TONE_CLASSES[tone] : null;
  return (
    <div className={cn('empty-panel animate-fade-up py-20 px-6 text-center', className)}>
      <div className="relative mx-auto max-w-lg">
        {Icon && (
          <div
            className={cn(
              'empty-icon-tile mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full',
              toneClasses ? toneClasses.text : 'text-primary',
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
        <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.03em] text-foreground leading-tight mb-3">
          {title}
        </h2>
        {description && (
          <p className="mx-auto mb-8 max-w-md text-[17px] leading-[1.47] text-muted">{description}</p>
        )}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3">
            {actions.map((action) => (
              <Button
                key={action.label}
                size="md"
                variant={action.primary === false ? 'secondary' : 'primary'}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
