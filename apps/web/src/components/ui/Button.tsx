'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

// Flat, bordered, sharp-cornered family matching the Zyvor Labs editorial style --
// solid rust fill for primary, bordered outline for secondary, plain text for ghost.
const variants: Record<Variant, string> = {
  primary:
    'rounded-md text-white bg-primary border border-primary ' +
    'hover:bg-[var(--primary-hover)] transition-colors',
  secondary:
    'rounded-md text-foreground border border-border bg-transparent ' +
    'hover:bg-surface hover:border-[var(--glass-border-strong)] transition-colors',
  ghost: 'rounded-md text-muted hover:text-foreground hover:bg-surface transition-colors',
  danger: 'rounded-md bg-danger/15 text-danger hover:bg-danger/25 transition-colors',
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
