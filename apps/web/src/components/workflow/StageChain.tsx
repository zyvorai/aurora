'use client';

import type { ChainStage } from '@/lib/chain';
import { cn } from '@/lib/cn';

const STATUS_DOT: Record<ChainStage['status'], string> = {
  idle: 'bg-border',
  need: 'bg-warning',
  run: 'bg-primary',
  done: 'bg-success',
};

const STATUS_BAR: Record<ChainStage['status'], string> = {
  idle: 'bg-border',
  need: 'bg-warning',
  run: 'bg-primary',
  done: 'bg-success',
};

const STATUS_LABEL_CLASS: Record<ChainStage['status'], string> = {
  idle: 'text-muted',
  need: 'text-warning',
  run: 'text-primary',
  done: 'text-foreground',
};

function statusMeta(status: ChainStage['status']): string {
  switch (status) {
    case 'idle': return 'locked';
    case 'need': return 'waiting on you';
    case 'run': return 'running';
    case 'done': return 'done';
  }
}

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
    <div className="flex overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface p-0.5">
      {stages.map((stage, i) => (
        <button
          key={stage.id}
          type="button"
          onClick={() => onSelect?.(stage.id)}
          className={cn(
            'relative flex-1 min-w-[112px] text-left px-3 py-2.5 rounded-[7px] transition-colors',
            'hover:bg-[var(--surface-elevated)]',
            activeId === stage.id && 'bg-[var(--surface-elevated)] ring-1 ring-inset ring-border',
            i > 0 && 'border-l border-border',
          )}
        >
          <div className="font-mono text-[10px] text-muted">{String(i + 1).padStart(2, '0')}</div>
          <div className={cn('mt-1 text-xs font-medium truncate', STATUS_LABEL_CLASS[stage.status])}>
            {stage.label}
          </div>
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--surface-elevated)]">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                STATUS_BAR[stage.status],
                stage.status === 'run' && 'chain-meter-run',
              )}
              style={{ width: stage.status === 'done' ? '100%' : stage.status === 'run' ? '55%' : '0%' }}
            />
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[stage.status])} aria-hidden />
            <span className="font-mono text-[10px] text-muted truncate">{statusMeta(stage.status)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
