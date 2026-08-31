'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Target, Upload } from 'lucide-react';
import { products, type ExecutiveBrief, type PipelineLead } from '@/lib/api';
import { PageHero } from '@/components/layout/PageHero';
import { KpiStrip, WorkspacePage, WorkspacePanel } from '@/components/layout/WorkspacePanel';
import { Button } from '@/components/ui/Button';
import { Badge, tierBadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/Table';
import { Eyebrow, Text, TextMuted, TextSmall } from '@/components/ui/Typography';
import { SourceLink } from '@/components/sources/SourceLink';
import forgeStyles from '@/components/workflow/forge.module.css';
import { cn } from '@/lib/cn';

export default function SalesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null);
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);

  const loadLeads = useCallback(() => {
    products.pipelineLeads(id).then(setLeads).catch(() => setLeads([]));
  }, [id]);

  useEffect(() => {
    products.brief(id).then(setBrief).catch(() => {});
    loadLeads();
  }, [id, loadLeads]);

  const profileBuilt = brief?.gtm_readiness.profile_built ?? false;

  async function runDiscover() {
    if (!profileBuilt) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await products.discoverLeads(id, { focus_industries: ['fintech', 'healthtech'], max_leads: 10 });
      setMessage(`Discovered ${res.discovered_count} accounts`);
      loadLeads();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleCsvImport(file: File) {
    if (!profileBuilt) return;
    setCsvBusy(true);
    setMessage(null);
    try {
      const csv = await file.text();
      const res = await products.discoverLeads(id, { csv_import: csv, max_leads: 50 });
      setMessage(`Imported ${res.discovered_count} accounts from CSV`);
      loadLeads();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setCsvBusy(false);
    }
  }

  async function runQualify() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await products.qualifyLeads(id, { focus_industries: ['fintech'] });
      setMessage(`Qualified ${res.qualified_count} leads · ${res.tier_a} tier A`);
      loadLeads();
      products.brief(id).then(setBrief).catch(() => {});
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Qualification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WorkspacePage>
      <PageHero
        eyebrow="Sales"
        title="Sales"
        description="Discover, qualify, and reach out — rules-based scoring so the same input always gives the same output."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={loading || !profileBuilt}
              onClick={runDiscover}
              title={!profileBuilt ? 'Build the product profile in Workspace first' : undefined}
            >
              Discover
            </Button>
            <Button size="sm" variant="secondary" disabled={loading || !profileBuilt} onClick={runQualify}>
              Qualify
            </Button>
            <Link href={`/products/${id}?tab=outreach`}>
              <Button size="sm">Outreach</Button>
            </Link>
            <Link href={`/products/${id}/pipeline`}>
              <Button size="sm" variant="secondary">
                Pipeline
              </Button>
            </Link>
          </div>
        }
      />

      {brief ? (
        <KpiStrip
          items={[
            { label: 'Accounts found', value: brief.kpis.accounts_found },
            { label: 'Qualified', value: brief.kpis.qualified },
            { label: 'Conversations', value: brief.kpis.conversations },
            { label: 'Agent runs', value: brief.kpis.agent_runs },
          ]}
        />
      ) : null}

      {brief && !profileBuilt ? (
        <div className={cn(forgeStyles.spotlight, 'flex flex-col sm:flex-row sm:items-center gap-5')}>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-primary mb-1.5">Blocked</p>
            <h2 className={forgeStyles.spotlightTitle}>Discover needs a product profile</h2>
            <p className={forgeStyles.spotlightBody}>
              Scoring compares each account against what this product actually does. Build the profile in Workspace first.
            </p>
          </div>
          <Link href={`/products/${id}`}>
            <Button>Open Workspace</Button>
          </Link>
        </div>
      ) : null}

      {message ? <TextMuted className="text-[15px]">{message}</TextMuted> : null}

      <WorkspacePanel
        title="Import accounts"
        description="Upload a CSV with company_name and domain columns to seed discovery."
      >
        <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative">
            <input
              type="file"
              accept=".csv,text/csv"
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              disabled={!profileBuilt || csvBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCsvImport(file);
                e.target.value = '';
              }}
            />
            <Button size="sm" variant="secondary" disabled={!profileBuilt || csvBusy} type="button">
              <Upload className="w-3.5 h-3.5 mr-1.5" aria-hidden />
              {csvBusy ? 'Importing…' : 'Upload CSV'}
            </Button>
          </div>
          <TextSmall className="text-muted">
            Columns: company_name, domain (optional: industry, company_size)
          </TextSmall>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Qualified leads" description={`${leads.length} lead${leads.length === 1 ? '' : 's'}`}>
        {leads.length > 0 ? (
          <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Company</TableHeaderCell>
                  <TableHeaderCell>Industry</TableHeaderCell>
                  <TableHeaderCell className="text-right">Score</TableHeaderCell>
                  <TableHeaderCell className="text-center">Tier</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow
                    key={lead.account_id}
                    onClick={() => setSelectedLead(lead)}
                    className="cursor-pointer hover:bg-background/60"
                  >
                    <TableCell>
                      <p className="font-medium">{lead.company_name}</p>
                      {lead.domain ? (
                        <SourceLink urlOrKey={lead.domain} variant="compact" stopPropagation className="mt-0.5" />
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted">{lead.industry ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lead.score ? Math.round(lead.score) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={tierBadgeVariant(lead.tier)}>{lead.tier}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4">
            <EmptyState
            icon={Target}
            title="No leads yet"
            description={
              profileBuilt
                ? 'Run Discover, then Qualify — or start an Outbound Sprint from Marketing.'
                : 'Discover and Qualify run after the product profile exists. Build it in Workspace first.'
            }
            actions={
              profileBuilt
                ? [
                    { label: 'Discover leads', onClick: runDiscover },
                    { label: 'Qualify leads', onClick: runQualify, primary: false },
                  ]
                : [{ label: 'Open Workspace', onClick: () => router.push(`/products/${id}`) }]
            }
            />
          </div>
        )}
      </WorkspacePanel>

      <Modal
        open={selectedLead !== null}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.company_name ?? ''}
      >
        {selectedLead && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={tierBadgeVariant(selectedLead.tier)}>{selectedLead.tier}</Badge>
              <TextSmall className="text-muted">
                {selectedLead.score ? `Score ${Math.round(selectedLead.score)}` : 'Not yet scored'}
              </TextSmall>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <Eyebrow>Industry</Eyebrow>
                <Text>{selectedLead.industry ?? '—'}</Text>
              </div>
              <div>
                <Eyebrow>Domain</Eyebrow>
                {selectedLead.domain ? (
                  <SourceLink urlOrKey={selectedLead.domain} variant="compact" />
                ) : (
                  <Text>—</Text>
                )}
              </div>
            </div>
            {selectedLead.explanation && (
              <div>
                <Eyebrow>Explanation</Eyebrow>
                <Text className="leading-relaxed">{selectedLead.explanation}</Text>
              </div>
            )}
            {selectedLead.factors && Object.keys(selectedLead.factors).length > 0 && (
              <div>
                <Eyebrow className="mb-2">Scoring factors</Eyebrow>
                <ul className="space-y-1.5">
                  {Object.entries(selectedLead.factors).map(([factor, weight]) => (
                    <li
                      key={factor}
                      className="flex justify-between text-sm border-b border-border/50 pb-1.5"
                    >
                      <span className="text-muted capitalize">{factor.replace(/_/g, ' ')}</span>
                      <span className="font-medium tabular-nums">+{String(weight)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Link href={`/products/${id}?tab=outreach`} className="flex-1">
                <Button size="sm">Draft outreach</Button>
              </Link>
              <Button variant="secondary" onClick={() => setSelectedLead(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </WorkspacePage>
  );
}
