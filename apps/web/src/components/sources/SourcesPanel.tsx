'use client';

import { useCallback, useEffect, useState } from 'react';
import { products, type ProductSource } from '@/lib/api';
import { useIngestPolling } from '@/lib/useIngestPolling';
import { showToast } from '@/lib/toast';
import { readStoredRole } from '@/lib/role-routing';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow,
} from '@/components/ui/Table';
import { TextMuted, TextSmall } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FolderOpen } from 'lucide-react';
import AddSourceWizard, { SOURCE_OPTIONS, type SourceKind } from '@/components/sources/AddSourceWizard';

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
  /** Lets a parent (e.g. Full Forge's "Import from GitHub" next-action) open the
   * wizard pre-set to a kind without owning the wizard's own open/closed state --
   * bump this to a new kind value to trigger it, cleared back to undefined after. */
  externalOpenKind?: SourceKind;
  onExternalOpenHandled?: () => void;
}

export default function SourcesPanel({
  productId,
  onIngestComplete,
  externalOpenKind,
  onExternalOpenHandled,
}: SourcesPanelProps) {
  const [sources, setSources] = useState<ProductSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardKind, setWizardKind] = useState<SourceKind | undefined>(undefined);

  function openWizard(kind?: SourceKind) {
    setWizardKind(kind);
    setWizardOpen(true);
  }
  const [message, setMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (!externalOpenKind) return;
    openWizard(externalOpenKind);
    onExternalOpenHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOpenKind]);

  const { polling, startPolling } = useIngestPolling({
    productId,
    onSources: setSources,
    onComplete: () => {
      showToast('success', 'Ingest complete.');
      onIngestComplete?.();
    },
    onError: (msg) => {
      setMessage(msg);
      showToast('error', msg);
    },
  });

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
        startPolling();
      } else {
        load();
        onIngestComplete?.();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ingest failed';
      setMessage(errorMessage);
      showToast('error', errorMessage);
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
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      setMessage(errorMessage);
      showToast('error', errorMessage);
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
              <Button size="sm" onClick={() => openWizard()} disabled={busy}>
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

      {canWrite && (
        <div className="flex flex-wrap gap-1.5">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.kind}
              type="button"
              disabled={busy}
              onClick={() => openWizard(opt.kind)}
              title={opt.description}
              className="font-mono text-xs text-muted border border-dashed border-border rounded-[6px] px-2 py-1 hover:border-primary hover:text-primary hover:border-solid transition-colors disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {message && <TextMuted>{message}</TextMuted>}

      {polling && (
        <ProgressBar
          percent={sources.length ? (sources.filter((s) => s.status === 'completed').length / sources.length) * 100 : 5}
          label="Ingesting sources…"
        />
      )}

      {loading ? (
        <TextMuted>Loading sources…</TextMuted>
      ) : sources.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No sources yet"
          description="Add a website URL, file, video, or other source to start building this product's knowledge base."
          actions={canWrite ? [{ label: '+ Add source', onClick: () => openWizard() }] : undefined}
        />
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
          initialKind={wizardKind}
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
