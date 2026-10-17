'use client';

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Filter bar above a table: search on the left, filters/actions on the right. Stacks on phones. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="toolbar" className={cn('mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  label = 'Search',
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <label className={cn('relative block w-full sm:max-w-xs', className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="focus-ring h-11 w-full rounded-[var(--radius-sm)] border border-border bg-surface-elevated pl-9 pr-3 text-[length:var(--fs-body)] text-foreground placeholder:text-muted"
      />
    </label>
  );
}
