'use client';

import type { ChainStage } from '@/lib/chain';
import { cn } from '@/lib/cn';

function statusMeta(status: ChainStage['status']): string {
  switch (status) {
    case 'idle':
      return 'Locked';
    case 'need':
      return 'Waiting on you';
    case 'run':
      return 'Running';
    case 'done':
      return 'Done';
  }
}

const STATUS_DOT: Record<ChainStage['status'], string> = {
  idle: 'bg-border',
  need: 'bg-warning',
  run: 'bg-primary',
  done: 'bg-success',
};

const TITLE_CLASS: Record<ChainStage['status'], string> = {
  idle: 'text-muted',
  need: 'text-foreground',
  run: 'text-foreground',
  done: 'text-foreground',
};

export function StageChain({
  stages,
  activeId,
  onSelect,
}: {
  stages: ChainStage[];
  activeId?: string;
  onSelect?: (id: ChainStage['id']) => void;
}) {
  return (
    <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 list-none m-0 p-0">
      {stages.map((stage, i) => {
        const active = activeId === stage.id;
        return (
          <li key={stage.id}>
            <button
              type="button"
              onClick={() => onSelect?.(stage.id)}
              className={cn(
                'w-full text-left rounded-[var(--radius-lg)] bg-surface px-4 py-4 transition-colors',
                'hover:bg-[var(--hs-bg-alt)]',
                active && 'ring-1 ring-inset ring-border bg-[var(--hs-bg-alt)]',
                stage.status === 'idle' && 'opacity-55',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-[12px] tabular-nums text-muted">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={cn('mt-1 h-2 w-2 rounded-full shrink-0', STATUS_DOT[stage.status])}
                  aria-hidden
                />
              </div>
              <p className={cn('mt-2 text-[17px] font-semibold tracking-[-0.02em] leading-tight', TITLE_CLASS[stage.status])}>
                {stage.label}
              </p>
              <p className="mt-1.5 text-[12px] text-muted">{statusMeta(stage.status)}</p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
