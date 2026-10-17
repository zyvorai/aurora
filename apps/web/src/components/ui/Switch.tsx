'use client';

import { cn } from '@/lib/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('focus-ring inline-flex h-11 w-14 items-center justify-center disabled:opacity-50', className)}
    >
      <span
        className={cn(
          'relative h-7 w-12 rounded-full transition-colors',
          checked ? 'bg-[var(--accent-blue)]' : 'bg-[var(--hairline)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-[var(--on-primary)] shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}
