'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { products, type WorkflowRunStatus } from '@/lib/api';
import { useResizableRail } from '@/hooks/useResizableRail';
import { cn } from '@/lib/cn';

const POLL_INTERVAL_MS = 4000;

const STATUS_DOT: Record<string, string> = {
  queued: 'bg-border',
  running: 'bg-primary',
  completed: 'bg-success',
  failed: 'bg-danger',
};

function runProgressPercent(run: WorkflowRunStatus): number {
  if (run.status === 'completed') return 100;
  if (run.status === 'failed') return 100;
  if (!run.steps.length) return run.status === 'running' ? 50 : 0;
  const done = run.steps.filter((s) => s.status === 'completed' || s.status === 'done').length;
  return Math.round((done / run.steps.length) * 100);
}

export function RunLogDock({ productId }: { productId: string }) {
  const [runs, setRuns] = useState<WorkflowRunStatus[]>([]);
  const dock = useResizableRail({ storageKey: 'ec-dock', defaultWidth: 288, min: 220, max: 420, collapsedWidth: 48, handleSide: 'left' });

  useEffect(() => {
    let cancelled = false;
    let timerId: number | undefined;

    const tick = async () => {
      try {
        const list = await products.workflowRuns(productId);
        if (!cancelled) setRuns(list);
      } catch {
        // dock is informational -- a failed poll just keeps the last known list
      }
      if (!cancelled) timerId = window.setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [productId]);

  const runningCount = runs.filter((r) => r.status === 'running' || r.status === 'queued').length;

  if (dock.collapsed) {
    return (
      <aside
        style={{ '--dock-w': `${dock.effectiveWidth}px` } as CSSProperties}
        className="w-[var(--dock-w)] shrink-0 border-l border-border bg-surface sticky top-0 h-screen hidden xl:flex flex-col items-center py-3.5 gap-2.5"
      >
        <button
          type="button"
          onClick={() => dock.setCollapsed(false)}
          aria-label="Expand run log"
          className="flex items-center justify-center h-6 w-6 rounded-[var(--radius-sm)] text-muted hover:text-foreground hover:bg-background transition-colors"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        {runningCount > 0 && (
          <span className="font-mono text-[10px] text-primary" title={`${runningCount} running`}>
            {runningCount}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside
      style={{ '--dock-w': `${dock.effectiveWidth}px` } as CSSProperties}
      className="relative w-[var(--dock-w)] shrink-0 border-l border-border bg-surface sticky top-0 h-screen hidden xl:flex flex-col"
    >
      <div
        onMouseDown={dock.startDrag}
        className="absolute top-0 bottom-0 left-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors"
        aria-hidden
      />
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
        <span className="font-display text-body-sm font-semibold text-foreground">Run log</span>
        <span className="ml-auto font-mono text-xs text-muted">
          {runningCount > 0 ? `${runningCount} running` : 'idle'}
        </span>
        <button
          type="button"
          onClick={() => dock.setCollapsed(true)}
          aria-label="Collapse run log"
          className="flex items-center justify-center h-6 w-6 rounded-[var(--radius-sm)] text-muted hover:text-foreground hover:bg-background transition-colors"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {runs.length === 0 ? (
          <div className="px-4 py-6 font-mono text-xs text-muted leading-relaxed">
            Nothing running.
            <br />
            <br />
            Agent work shows up here with live progress. You can leave the page — runs finish on the server.
          </div>
        ) : (
          runs.map((run) => {
            const pct = runProgressPercent(run);
            return (
              <div key={run.id} className="grid grid-cols-[8px_1fr] gap-2.5 px-4 py-2.5 border-b border-border/60">
                <span
                  className={cn('mt-1 h-2 w-2 rounded-full', STATUS_DOT[run.status] ?? 'bg-border')}
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="font-mono text-xs text-foreground truncate">{run.workflow_name}</div>
                  <div className="font-mono text-[10px] text-muted mt-0.5">
                    {run.status === 'failed' ? (run.error_message ?? 'failed') : run.status}
                  </div>
                  {run.status === 'running' && (
                    <div className="mt-1.5 h-0.5 w-full rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-4 py-2.5 font-mono text-[10px] text-muted">
        Runs continue if you close this tab.
      </div>
    </aside>
  );
}
