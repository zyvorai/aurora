'use client';

import { cn } from '@/lib/cn';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'tier-a' | 'tier-b' | 'tier-c';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface text-muted border-border',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  'tier-a': 'bg-success/15 text-success',
  'tier-b': 'bg-warning/15 text-warning',
  'tier-c': 'bg-surface text-muted',
};

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-transparent',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function tierBadgeVariant(tier: string): BadgeVariant {
  if (tier === 'A') return 'tier-a';
  if (tier === 'B') return 'tier-b';
  return 'tier-c';
}
