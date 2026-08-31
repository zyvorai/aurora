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
        onClick && 'cursor-pointer hover:bg-surface/80',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableHeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn('px-4 py-2.5 text-[11px] font-normal tracking-[0.02em] uppercase text-muted', className)}>
      {children}
    </th>
  );
}

export function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 text-[13px]', className)}>{children}</td>;
}
