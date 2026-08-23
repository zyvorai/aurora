'use client';

import { useEffect, useState } from 'react';
import { products, type WorkflowRunStatus } from '@/lib/api';
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

  return (
    <aside className="w-72 shrink-0 border-l border-border bg-surface sticky top-0 h-screen hidden xl:flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
        <span className="font-display text-body-sm font-semibold text-foreground">Run log</span>
        <span className="ml-auto font-mono text-xs text-muted">
          {runningCount > 0 ? `${runningCount} running` : 'idle'}
        </span>
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
