import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface-elevated', className)}>
      <table className="w-full text-body-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-surface text-muted text-left">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      className={cn(
        'border-t border-border first:border-t-0',
        onClick && 'cursor-pointer hover:bg-surface/80 focus-ring',
        className,
      )}
      onClick={onClick}
      // Clickable rows are keyboard-operable: focusable, Enter/Space activate.
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {children}
    </tr>
  );
}

export function TableHeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn('px-4 py-2.5 text-[length:var(--fs-micro)] font-normal tracking-[0.02em] uppercase text-muted', className)}>
      {children}
    </th>
  );
}

export function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 text-[length:var(--fs-small)]', className)}>{children}</td>;
}
