import { useEffect, useState } from 'react';
import { products, type ProductSource } from '@/lib/api';

const MAX_ATTEMPTS = 40;
const POLL_INTERVAL_MS = 3000;

const PENDING_STATUSES = new Set(['pending', 'crawling', 'processing']);

interface UseIngestPollingOptions {
  productId: string;
  onSources?: (sources: ProductSource[]) => void;
  onComplete?: () => void;
  onError?: (message: string) => void;
}

/**
 * Polls a product's source list after an async ingest/refresh call until every
 * source leaves pending/crawling/processing, or MAX_ATTEMPTS is reached.
 */
export function useIngestPolling({ productId, onSources, onComplete, onError }: UseIngestPollingOptions) {
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!polling) return;

    let attempts = 0;
    let cancelled = false;
    let timerId: number | undefined;

    const tick = async () => {
      if (cancelled || attempts >= MAX_ATTEMPTS) {
        setPolling(false);
        return;
      }
      attempts += 1;
      try {
        const list = await products.listSources(productId, { timeoutMs: 8000 });
        if (cancelled) return;
        onSources?.(list);
        const pending = list.some((s) => PENDING_STATUSES.has(s.status));
        if (!pending) {
          setPolling(false);
          onComplete?.();
          return;
        }
      } catch {
        setPolling(false);
        onError?.('API unavailable — run make start and refresh.');
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
  }, [polling, productId]);

  return { polling, startPolling: () => setPolling(true) };
}
