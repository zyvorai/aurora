import { useEffect, useState } from 'react';
import { products, type WorkflowRunStatus } from '@/lib/api';
import { sanitizeWorkflowError } from '@/lib/workflow-errors';

const MAX_ATTEMPTS = 240;
const POLL_INTERVAL_MS = 3000;

interface UseWorkflowPollingOptions {
  onComplete?: (run: WorkflowRunStatus) => void;
  onError?: (message: string) => void;
}

/**
 * Polls a WorkflowRun (GET /workflows/runs/{id}) after an async job kickoff
 * until status is 'completed' or 'failed', or MAX_ATTEMPTS is reached.
 * Unlike the hand-rolled poll loops this replaces, a thrown fetch error stops
 * polling and reports via onError instead of breaking silently.
 */
export function useWorkflowPolling({ onComplete, onError }: UseWorkflowPollingOptions = {}) {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [run, setRun] = useState<WorkflowRunStatus | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!activeRunId) return;

    let attempts = 0;
    let cancelled = false;
    let timerId: number | undefined;

    const tick = async () => {
      if (cancelled) return;
      if (attempts >= MAX_ATTEMPTS) {
        setPolling(false);
        onError?.('Polling timed out');
        return;
      }
      attempts += 1;
      try {
        const status = await products.pollWorkflow(activeRunId);
        if (cancelled) return;
        setRun(status);
        if (status.status === 'completed' || status.status === 'failed') {
          setPolling(false);
          if (status.status === 'failed') {
            onError?.(sanitizeWorkflowError(status.error_message));
          } else {
            onComplete?.(status);
          }
          return;
        }
      } catch (err) {
        if (cancelled) return;
        setPolling(false);
        onError?.(err instanceof Error ? err.message : 'Failed to poll workflow status');
        return;
      }
      timerId = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    timerId = window.setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId]);

  function startPolling(runId: string) {
    setRun(null);
    setPolling(true);
    setActiveRunId(runId);
  }

  return { run, polling, startPolling };
}
