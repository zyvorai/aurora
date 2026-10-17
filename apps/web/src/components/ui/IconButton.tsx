'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only control must have an accessible name. */
  'aria-label': string;
}

/** Icon-only control with a 44px hit area (--hit-min). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted',
        'transition-colors hover:bg-[var(--nav-hover-bg)] hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';
