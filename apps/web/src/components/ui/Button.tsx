'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

const variants: Record<Variant, string> = {
  primary:
    'rounded-[var(--radius-pill)] text-white bg-primary border border-primary ' +
    'hover:bg-[var(--primary-hover)] transition-colors',
  secondary:
    'rounded-[var(--radius-pill)] text-foreground border border-[var(--border)] bg-transparent ' +
    'hover:bg-[var(--nav-hover-bg)] transition-colors',
  ghost: 'rounded-[var(--radius-sm)] text-muted hover:text-foreground hover:bg-[var(--nav-hover-bg)] transition-colors',
  danger: 'rounded-[var(--radius-pill)] bg-danger/10 text-danger hover:bg-danger/15 transition-colors',
  link: 'text-[var(--accent-blue)] hover:underline p-0 h-auto font-normal',
};

const sizes = {
  sm: 'px-3.5 py-1.5 text-body-sm',
  md: 'px-5 py-2 text-body',
  lg: 'px-6 py-2.5 text-body font-medium',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center font-medium focus-ring disabled:opacity-50 disabled:pointer-events-none',
        variant !== 'link' && sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
