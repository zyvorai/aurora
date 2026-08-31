'use client';

import { cn } from '@/lib/cn';

export type BadgeVariant =
  | 'default' | 'success' | 'warning' | 'danger' | 'tier-a' | 'tier-b' | 'tier-c'
  | 'blue' | 'pink' | 'teal' | 'purple';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface text-muted border-border',
  success: 'bg-surface text-success border-border',
  warning: 'bg-surface text-warning border-border',
  danger: 'bg-surface text-danger border-border',
  'tier-a': 'bg-surface text-success border-border',
  'tier-b': 'bg-surface text-warning border-border',
  'tier-c': 'bg-surface text-muted border-border',
  blue: 'bg-surface text-primary border-border',
  pink: 'bg-surface text-accent-pink border-border',
  teal: 'bg-surface text-accent-teal border-border',
  purple: 'bg-surface text-accent-purple border-border',
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
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-normal border',
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
