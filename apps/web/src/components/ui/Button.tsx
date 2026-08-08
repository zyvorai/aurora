'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

// Primary/secondary/danger share the "tahoe pill" shape so they read as one
// family when rendered side by side in an action row; ghost stays a plain
// transparent rounded-md so icon-only buttons (Modal close, theme toggle)
// don't get a heavy chip background at small sizes.
const variants: Record<Variant, string> = {
  primary:
    'rounded-full text-white border border-white/20 ' +
    'bg-gradient-to-b from-[rgb(56,189,248)] to-[rgb(37,99,235)] ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-6px_rgba(37,99,235,0.45)] ' +
    'hover:brightness-[1.06] hover:-translate-y-px transition-[filter,transform]',
  secondary:
    'rounded-full text-foreground border border-[var(--glass-border)] bg-[var(--glass-bg)] ' +
    'backdrop-blur-sm hover:border-[var(--glass-border-strong)] hover:bg-[var(--glass-bg-elevated)] transition-colors',
  ghost: 'rounded-md text-muted hover:text-foreground hover:bg-surface transition-colors',
  danger: 'rounded-full bg-danger/15 text-danger hover:bg-danger/25 transition-colors',
};

const sizes = {
  sm: 'px-3 py-1.5 text-body-sm',
  md: 'px-4 py-2 text-body',
  lg: 'px-6 py-3 text-body font-semibold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center font-medium focus-ring disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
