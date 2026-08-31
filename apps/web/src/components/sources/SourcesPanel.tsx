'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { products, type ProductSource } from '@/lib/api';
import { useIngestPolling } from '@/lib/useIngestPolling';
import { showToast } from '@/lib/toast';
import { readStoredRole } from '@/lib/role-routing';
import { groupSources } from '@/lib/source-display';
import { SourceLink } from '@/components/sources/SourceLink';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TextMuted } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  ChevronDown, ChevronUp, Code2, Database, FileText, FolderOpen, Github, Globe,
  Plus, Table2, Youtube,
} from 'lucide-react';
import AddSourceWizard, { SOURCE_OPTIONS, type SourceKind } from '@/components/sources/AddSourceWizard';
import forgeStyles from '@/components/workflow/forge.module.css';
import { cn } from '@/lib/cn';

function statusVariant(status: string): 'success' | 'warning' | 'default' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'warning';
  return 'default';
}

function sourceIconMeta(type: string): { Icon: typeof Globe; className: string } {
  const t = type.toLowerCase();
  if (t.includes('github')) return { Icon: Github, className: forgeStyles.sourceIconGit };
  if (t.includes('database') || t === 'db') return { Icon: Database, className: forgeStyles.sourceIconDb };
  if (t.includes('video') || t.includes('youtube') || t.includes('audio')) {
    return { Icon: Youtube, className: forgeStyles.sourceIconFile };
  }
  if (t.includes('spreadsheet') || t.includes('csv') || t.includes('xlsx')) {
    return { Icon: Table2, className: forgeStyles.sourceIconFile };
  }
  if (t.includes('openapi') || t.includes('swagger')) return { Icon: Code2, className: forgeStyles.sourceIconSky };
  if (t.includes('document') || t.includes('pdf') || t.includes('doc')) {
    return { Icon: FileText, className: forgeStyles.sourceIconFile };
  }
  return { Icon: Globe, className: forgeStyles.sourceIconSky };
}

interface SourcesPanelProps {
  productId: string;
  onIngestComplete?: () => void;
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const groupedSources = useMemo(() => groupSources(sources), [sources]);

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

  async function handleDeleteGroup(ids: string[]) {
    const label = ids.length > 1 ? `Delete ${ids.length} duplicate sources and their indexed content?` : 'Delete this source and its indexed content?';
    if (!confirm(label)) return;
    setBusy(true);
    try {
      await Promise.all(ids.map((sourceId) => products.deleteSource(productId, sourceId)));
      load();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      setMessage(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setBusy(false);
    }
  }

  function toggleGroupSelect(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function groupIds(group: ReturnType<typeof groupSources>[number]): string[] {
    return [group.primary.id, ...group.duplicates.map((d) => d.id)];
  }

  return (
    <section id="sources" className="space-y-4">
      <div className={forgeStyles.panel}>
        <div className={forgeStyles.panelHeader}>
          <div className="min-w-0">
            <h2 className={forgeStyles.panelTitle}>Sources</h2>
            <p className={forgeStyles.panelDesc}>
              URLs, files, and specs that ground every agent answer.
            </p>
          </div>
          {canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openWizard()} disabled={busy}>
                <Plus className="w-3.5 h-3.5 mr-1" aria-hidden />
                Add source
              </Button>
              {sources.length > 0 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => handleIngest(selected.size ? [...selected] : undefined)}
                >
                  {selected.size ? `Ingest (${selected.size})` : 'Ingest all'}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {canWrite && (
          <div className="border-b border-border bg-[var(--surface)]/50">
            {sources.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuickAddOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-[13px] font-medium text-muted hover:text-foreground transition-colors"
              >
                <span>Quick add</span>
                {quickAddOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            ) : null}
            {(sources.length === 0 || quickAddOpen) && (
              <div className="p-3 sm:p-4 pt-0 sm:pt-0">
                <div className={forgeStyles.sourceTypeGrid}>
                  {SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.kind}
                      type="button"
                      disabled={busy}
                      onClick={() => openWizard(opt.kind)}
                      className={forgeStyles.sourceTypeBtn}
                    >
                      <span className={forgeStyles.sourceTypeLabel}>{opt.label}</span>
                      <span className={forgeStyles.sourceTypeHint}>{opt.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {message ? (
          <div className="px-4 py-2.5 border-b border-border bg-surface">
            <TextMuted className="text-[13px]">{message}</TextMuted>
          </div>
        ) : null}

        {polling ? (
          <div className="px-4 py-3 border-b border-border">
            <ProgressBar
              percent={
                sources.length
                  ? (sources.filter((s) => s.status === 'completed').length / sources.length) * 100
                  : 5
              }
              label="Ingesting sources…"
            />
          </div>
        ) : null}

        {loading ? (
          <div className="px-4 py-8 text-center">
            <TextMuted className="text-[13px]">Loading sources…</TextMuted>
          </div>
        ) : sources.length === 0 ? (
          <div className="px-4 py-6">
            <EmptyState
              icon={FolderOpen}
              title="No sources yet"
              description="Add a website URL, file, or repo to start building this product's knowledge base."
              actions={canWrite ? [{ label: 'Add source', onClick: () => openWizard() }] : undefined}
            />
          </div>
        ) : (
          <ul className="list-none m-0 p-0">
            {groupedSources.map((group) => {
              const s = group.primary;
              const ids = groupIds(group);
              const { Icon, className: iconClass } = sourceIconMeta(s.source_type);
              const path = s.url ?? s.storage_key ?? s.display_name;
              const groupSelected = ids.some((id) => selected.has(id));

              return (
              <li key={group.key} className={forgeStyles.sourceRow}>
                {canWrite ? (
                  <input
                    type="checkbox"
                    className="shrink-0"
                    checked={groupSelected}
                    onChange={() => toggleGroupSelect(ids)}
                    aria-label={`Select ${s.display_name ?? s.source_type}`}
                  />
                ) : (
                  <span className={cn(forgeStyles.sourceIcon, iconClass)} aria-hidden>
                    <Icon className="w-4 h-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className={forgeStyles.sourceName}>
                    {s.display_name ?? s.source_type}
                    {group.duplicates.length > 0 ? (
                      <span className={forgeStyles.duplicateBadge}>+{group.duplicates.length} duplicate</span>
                    ) : null}
                  </p>
                  {path ? (
                    <div className={forgeStyles.sourceMeta}>
                      <SourceLink urlOrKey={path} />
                    </div>
                  ) : null}
                  {s.error_message ? (
                    <p className="mt-1 text-[11px] text-warning">{s.error_message}</p>
                  ) : null}
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                    {s.pages_discovered > 0 ? (
                      <span className="text-[11px] tabular-nums text-muted hidden sm:inline">
                        {s.pages_processed}/{s.pages_discovered}
                      </span>
                    ) : null}
                  </div>
                  {canWrite ? (
                    <div className={forgeStyles.sourceActions}>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => handleIngest(ids, s.status === 'completed')}
                      >
                        Ingest
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleDeleteGroup(ids)}>
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
            })}
          </ul>
        )}
      </div>

      {wizardOpen ? (
        <AddSourceWizard
          productId={productId}
          initialKind={wizardKind}
          onClose={() => setWizardOpen(false)}
          onCreated={() => {
            setWizardOpen(false);
            load();
          }}
        />
      ) : null}
    </section>
  );
}
