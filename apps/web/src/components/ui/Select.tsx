'use client';

import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  /** Visually hide the label (it stays available to assistive tech). */
  hideLabel?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hideLabel, className, id, children, ...props }, ref) => {
    const auto = useId();
    const selectId = id ?? auto;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className={cn('text-[length:var(--fs-small)] text-muted', hideLabel && 'sr-only')}>
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'focus-ring h-11 rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-3',
            'text-[length:var(--fs-body)] text-foreground disabled:opacity-50',
            className,
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  },
);
Select.displayName = 'Select';
