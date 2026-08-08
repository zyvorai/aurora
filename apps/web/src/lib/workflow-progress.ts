import type { WorkflowRunStatus } from '@/lib/api';

/**
 * Approximate percent-complete for a WorkflowRunStatus. The API only reports
 * steps as they're appended (the total step count isn't known up front), so
 * this is a best-effort signal, not an exact fraction -- pair it with the
 * step list in the UI for full transparency.
 */
export function workflowProgressPercent(run: WorkflowRunStatus | null): number {
  if (!run) return 0;
  if (run.status === 'completed') return 100;
  if (!run.steps.length) return run.status === 'queued' ? 5 : 10;

  const weight = { completed: 1, skipped: 1, failed: 1, running: 0.5 } as const;
  const sum = run.steps.reduce((acc, step) => acc + (weight[step.status as keyof typeof weight] ?? 0), 0);
  return Math.min(95, Math.round((sum / run.steps.length) * 100));
}
