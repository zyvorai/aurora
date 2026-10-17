'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/cn';

interface ErrorStateProps {
  message: string;
  title?: string;
  /** When set, a secondary "Try again" action is shown. */
  onRetry?: () => void;
  className?: string;
}

/** Inline failure with a next action — use instead of a toast-only error that leaves a blank page. */
export function ErrorState({ message, title, onRetry, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-[var(--radius-md)] border border-danger/30 bg-danger/10 p-4',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="mb-1 text-[length:var(--fs-body)] font-semibold text-foreground">{title}</p>}
        <p className="text-[length:var(--fs-small)] leading-relaxed text-foreground">{message}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
