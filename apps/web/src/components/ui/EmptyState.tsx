'use client';

import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { SectionTitle, TextMuted } from './Typography';
import { cn } from '@/lib/cn';

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
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={cn('tahoe-empty animate-fade-up py-16 px-6 text-center', className)}>
      <div className="tahoe-empty-orb" aria-hidden />
      <div className="relative">
        {Icon && (
          <div className="tahoe-empty-icon mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-primary">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <SectionTitle className="mb-2">{title}</SectionTitle>
        {description && (
          <TextMuted className="mx-auto mb-6 max-w-md">{description}</TextMuted>
        )}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3">
            {actions.map((action) => (
              <Button
                key={action.label}
                size="lg"
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
