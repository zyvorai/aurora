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
    'rounded-full text-white bg-[var(--accent-blue)] border border-[var(--accent-blue)] ' +
    'hover:bg-[var(--accent-blue-hover)] hover:border-[var(--accent-blue-hover)] transition-colors font-normal',
  secondary:
    'rounded-full text-foreground border border-[var(--border)] bg-transparent ' +
    'hover:bg-[var(--nav-hover-bg)] transition-colors font-normal',
  ghost: 'rounded-[var(--radius-sm)] text-muted hover:text-foreground hover:bg-[var(--nav-hover-bg)] transition-colors font-normal',
  danger: 'rounded-full bg-danger/10 text-danger hover:bg-danger/15 transition-colors font-normal',
  link: 'text-[var(--accent-blue)] hover:underline underline-offset-2 p-0 h-auto font-normal',
};

/** Comfortable tap targets — default md (40px). */
const sizes = {
  sm: 'h-9 min-h-9 px-4 text-[14px] leading-none',
  md: 'h-10 min-h-10 px-5 text-[15px] leading-none',
  lg: 'h-11 min-h-11 px-6 text-[16px] leading-none',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center focus-ring disabled:opacity-50 disabled:pointer-events-none',
        variant !== 'link' && sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
