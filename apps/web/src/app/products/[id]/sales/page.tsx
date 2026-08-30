'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Target } from 'lucide-react';
import { products, type ExecutiveBrief, type PipelineLead } from '@/lib/api';
import { PageHero } from '@/components/layout/PageHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Badge, tierBadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/Table';
import { Eyebrow, Text, TextMuted, TextSmall } from '@/components/ui/Typography';

export default function SalesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null);
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);

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
    <div className="space-y-10 animate-fade-up">
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

      {brief && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 border-y border-border py-6">
          {[
            { label: 'Accounts found', value: brief.kpis.accounts_found },
            { label: 'Qualified', value: brief.kpis.qualified },
            { label: 'Conversations', value: brief.kpis.conversations },
            { label: 'Agent runs', value: brief.kpis.agent_runs },
          ].map((kpi) => (
            <div key={kpi.label}>
              <p className="text-[28px] font-semibold tracking-[-0.03em] tabular-nums text-foreground leading-none">
                {kpi.value}
              </p>
              <p className="mt-2 text-[12px] text-muted">{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {brief && !profileBuilt && (
        <div className="rounded-[var(--radius-lg)] bg-surface px-6 py-8 sm:px-8 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex-1 min-w-0">
            <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-foreground">
              Discover needs a product profile
            </h2>
            <p className="mt-2 text-[15px] leading-[1.47] text-muted max-w-[52ch]">
              Scoring compares each account against what this product actually does. Build the profile in
              Workspace first.
            </p>
            <p className="mt-3 text-[12px] text-muted">Blocked by ingest → product profile</p>
          </div>
          <Link href={`/products/${id}`}>
            <Button size="lg">Open Workspace</Button>
          </Link>
        </div>
      )}

      {message && <TextMuted className="text-[15px]">{message}</TextMuted>}

      <section>
        <SectionHeader title="Qualified leads" />
        {leads.length > 0 ? (
          <div className="rounded-[var(--radius-lg)] bg-surface overflow-hidden">
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
                    <TableCell className="font-medium">{lead.company_name}</TableCell>
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
          </div>
        ) : (
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
        )}
      </section>

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
                <Text>{selectedLead.domain ?? '—'}</Text>
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
                <Button className="w-full">Draft outreach</Button>
              </Link>
              <Button variant="secondary" onClick={() => setSelectedLead(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
