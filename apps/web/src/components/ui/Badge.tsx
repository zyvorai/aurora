'use client';

import { cn } from '@/lib/cn';

export type BadgeVariant =
  | 'default' | 'success' | 'warning' | 'danger' | 'tier-a' | 'tier-b' | 'tier-c'
  | 'blue' | 'pink' | 'teal' | 'purple';

// Tints mix each semantic color against the theme-aware elevated-surface token
// (not literal `white`), so pills read as soft-tinted chips — not flat/monochrome
// — and stay correct in dark mode instead of washing out.
const tint = (color: string) => `bg-[color-mix(in_srgb,var(${color})_16%,var(--surface-elevated))] border-transparent`;

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface text-muted border-border',
  success: `${tint('--success')} text-success`,
  warning: `${tint('--warning')} text-warning`,
  danger: `${tint('--danger')} text-danger`,
  'tier-a': `${tint('--success')} text-success`,
  'tier-b': `${tint('--warning')} text-warning`,
  'tier-c': 'bg-surface text-muted border-border',
  blue: `${tint('--primary')} text-primary`,
  pink: `${tint('--accent-pink')} text-accent-pink`,
  teal: `${tint('--accent-teal')} text-accent-teal`,
  purple: `${tint('--accent-purple')} text-accent-purple`,
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
