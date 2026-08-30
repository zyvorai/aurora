'use client';

import { useCallback, useEffect, useState } from 'react';
import { products, type ProductSource } from '@/lib/api';
import { useIngestPolling } from '@/lib/useIngestPolling';
import { showToast } from '@/lib/toast';
import { readStoredRole } from '@/lib/role-routing';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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
  /** Parent can open the wizard to a kind (e.g. GitHub) without owning open state. */
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
  const [message, setMessage] = useState<string | null>(null);

  function openWizard(kind?: SourceKind) {
    setWizardKind(kind);
    setWizardOpen(true);
  }

  const role = readStoredRole();
  const canWrite = role === 'admin' || role === 'editor';

  const load = useCallback(() => {
    setLoading(true);
    products
      .listSources(productId)
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
    <section id="sources" className="space-y-5">
      <SectionHeader
        title="Sources"
        description="URLs, files, repos, and specs that ground every agent answer."
        action={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openWizard()} disabled={busy}>
                Add source
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
        <div className="flex flex-wrap gap-2">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.kind}
              type="button"
              disabled={busy}
              onClick={() => openWizard(opt.kind)}
              title={opt.description}
              className="text-[12px] text-muted px-3 py-1.5 rounded-full bg-surface hover:text-foreground hover:bg-[var(--hs-bg-alt)] transition-colors disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {message && <TextMuted className="text-[15px]">{message}</TextMuted>}

      {polling && (
        <ProgressBar
          percent={
            sources.length
              ? (sources.filter((s) => s.status === 'completed').length / sources.length) * 100
              : 5
          }
          label="Ingesting sources…"
        />
      )}

      {loading ? (
        <TextMuted>Loading sources…</TextMuted>
      ) : sources.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No sources yet"
          description="Add a website URL, file, or repo to start building this product's knowledge base."
          actions={canWrite ? [{ label: 'Add source', onClick: () => openWizard() }] : undefined}
        />
      ) : (
        <ul className="rounded-[var(--radius-lg)] bg-surface divide-y divide-border overflow-hidden list-none m-0 p-0">
          {sources.map((s) => (
            <li key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
              {canWrite && (
                <input
                  type="checkbox"
                  className="shrink-0 mt-1 sm:mt-0"
                  checked={selected.has(s.id)}
                  onChange={() => toggleSelect(s.id)}
                  aria-label={`Select ${s.display_name ?? s.source_type}`}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-foreground truncate">
                  {s.display_name ?? s.source_type}
                </p>
                <p className="mt-0.5 text-[12px] text-muted truncate">{locationLabel(s)}</p>
                {s.error_message && (
                  <TextSmall className="block mt-1 text-warning">{s.error_message}</TextSmall>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Badge variant="default">{s.source_type}</Badge>
                <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                <span className="text-[12px] tabular-nums text-muted">
                  {s.pages_processed}/{s.pages_discovered}
                </span>
                {canWrite && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => handleIngest([s.id], s.status === 'completed')}
                    >
                      Ingest
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleDelete(s.id)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
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
