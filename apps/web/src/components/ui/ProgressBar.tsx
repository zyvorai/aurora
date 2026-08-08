'use client';

import { cn } from '@/lib/cn';

interface ProgressBarProps {
  percent: number;
  label?: string;
  showPercent?: boolean;
  className?: string;
}

export function ProgressBar({ percent, label, showPercent = true, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className={className}>
      {(label || showPercent) && (
        <div className="mb-1.5 flex items-center justify-between text-body-sm">
          {label && <span className="text-foreground">{label}</span>}
          {showPercent && <span className="text-muted tabular-nums">{Math.round(clamped)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-surface"
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            clamped >= 100 ? 'bg-success' : 'bg-primary',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
