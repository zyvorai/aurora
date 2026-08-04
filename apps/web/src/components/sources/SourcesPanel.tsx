'use client';

import { useCallback, useEffect, useState } from 'react';
import { products, type ProductSource } from '@/lib/api';
import { readStoredRole } from '@/lib/role-routing';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow,
} from '@/components/ui/Table';
import { TextMuted, TextSmall } from '@/components/ui/Typography';
import AddSourceWizard from '@/components/sources/AddSourceWizard';

function statusVariant(status: string): 'success' | 'warning' | 'default' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'warning';
  return 'default';
}

function locationLabel(source: ProductSource): string {
  if (source.url) return source.url;
  if (source.display_name) return source.display_name;
  if (source.storage_key) return source.storage_key.split('/').pop() ?? 'upload';
  return '—';
}

interface SourcesPanelProps {
  productId: string;
  onIngestComplete?: () => void;
}

export default function SourcesPanel({ productId, onIngestComplete }: SourcesPanelProps) {
  const [sources, setSources] = useState<ProductSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pollIngest, setPollIngest] = useState(false);

  const role = readStoredRole();
  const canWrite = role === 'admin' || role === 'editor';

  const load = useCallback(() => {
    setLoading(true);
    products.listSources(productId)
      .then(setSources)
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll source status after async ingest; stop after max attempts or when API is down.
  useEffect(() => {
    if (!pollIngest) return;

    let attempts = 0;
    let cancelled = false;
    let timerId: number | undefined;
    const maxAttempts = 40;

    const tick = async () => {
      if (cancelled || attempts >= maxAttempts) {
        setPollIngest(false);
        return;
      }
      attempts += 1;
      try {
        const list = await products.listSources(productId, { timeoutMs: 8000 });
        if (cancelled) return;
        setSources(list);
        const pending = list.some((s) => s.status === 'pending' || s.status === 'crawling' || s.status === 'processing');
        if (!pending) {
          setPollIngest(false);
          onIngestComplete?.();
          return;
        }
      } catch {
        setPollIngest(false);
        setMessage('API unavailable — run make start and refresh.');
        return;
      }
      timerId = window.setTimeout(tick, 3000);
    };

    timerId = window.setTimeout(tick, 3000);
    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [pollIngest, productId, onIngestComplete]);

  async function handleIngest(sourceIds?: string[], force = false) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await products.ingest(productId, {
        source_ids: sourceIds,
        force,
        async_mode: true,
      });
      setMessage(res.message);
      if (res.status === 'queued') {
        setPollIngest(true);
      } else {
        load();
        onIngestComplete?.();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ingest failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(sourceId: string) {
    if (!confirm('Delete this source and its indexed content?')) return;
    setBusy(true);
    try {
      await products.deleteSource(productId, sourceId);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section id="sources" className="space-y-4">
      <SectionHeader
        label="Knowledge"
        title="Sources"
        description="Add URLs, files, videos, spreadsheets, GitHub repos, OpenAPI specs, or database exports."
        action={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setWizardOpen(true)} disabled={busy}>
                + Add source
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || sources.length === 0}
                onClick={() => handleIngest(selected.size ? [...selected] : undefined)}
              >
                {selected.size ? `Ingest selected (${selected.size})` : 'Ingest all'}
              </Button>
            </div>
          ) : undefined
        }
      />

      {message && <TextMuted>{message}</TextMuted>}

      {loading ? (
        <TextMuted>Loading sources…</TextMuted>
      ) : sources.length === 0 ? (
        <TextMuted>No sources yet. Add a website URL at onboarding or use Add source.</TextMuted>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              {canWrite && <TableHeaderCell className="w-8">&nbsp;</TableHeaderCell>}
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Location</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">Pages</TableHeaderCell>
              {canWrite && <TableHeaderCell className="text-right">Actions</TableHeaderCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {sources.map((s) => (
              <TableRow key={s.id}>
                {canWrite && (
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      aria-label={`Select ${s.display_name ?? s.source_type}`}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  {s.display_name ?? s.source_type}
                </TableCell>
                <TableCell>
                  <Badge variant="default">{s.source_type}</Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted">
                  {locationLabel(s)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                  {s.error_message && (
                    <TextSmall className="block mt-1 text-warning">{s.error_message}</TextSmall>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.pages_processed}/{s.pages_discovered}
                </TableCell>
                {canWrite && (
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => handleIngest([s.id], s.status === 'completed')}
                    >
                      Ingest
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => handleDelete(s.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {wizardOpen && (
        <AddSourceWizard
          productId={productId}
          onClose={() => setWizardOpen(false)}
          onCreated={() => {
            setWizardOpen(false);
            load();
          }}
        />
      )}
    </section>
  );
}
