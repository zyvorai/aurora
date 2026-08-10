'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { products, type ExecutiveBrief, type PipelineLead } from '@/lib/api';
import { PageHero } from '@/components/layout/PageHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, tierBadgeVariant } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/Table';
import { Eyebrow, Stat, Text, TextMuted, TextSmall } from '@/components/ui/Typography';

export default function SalesPage() {
  const { id } = useParams<{ id: string }>();
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

  async function runDiscover() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await products.discoverLeads(id, { focus_industries: ['fintech', 'healthtech'], max_leads: 10 });
      setMessage(`Discovered ${res.discovered_count} accounts (no LLM)`);
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

  const actions = [
    { label: 'Discover leads', onClick: runDiscover },
    { label: 'Qualify leads', onClick: runQualify },
    { label: 'Outreach', href: `/products/${id}?tab=outreach`, primary: true },
    { label: 'Pipeline', href: `/products/${id}/pipeline` },
  ];

  return (
    <div className="space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Sales"
        title="Sales Action"
        description="Qualified leads, outreach, and proposals — discovery and scoring run without LLM."
      />

      {brief && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pipeline leads', value: brief.kpis.leads },
            { label: 'Conversations', value: brief.kpis.conversations },
            { label: 'Artifacts', value: brief.kpis.artifacts },
            { label: 'Agent runs', value: brief.kpis.agent_runs },
          ].map((kpi) => (
            <Card key={kpi.label} elevated>
              <CardBody className="py-4">
                <Stat label={kpi.label} value={kpi.value} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {actions.map((action) =>
          action.href ? (
            <Link key={action.label} href={action.href}>
              <Card elevated className="h-full hover:border-primary/40 transition-colors cursor-pointer">
                <CardBody className="py-4 text-center">
                  <Text className="font-medium text-center">{action.label}</Text>
                </CardBody>
              </Card>
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              disabled={loading}
              onClick={action.onClick}
              className="text-left disabled:opacity-50"
            >
              <Card elevated className="h-full hover:border-primary/40 transition-colors">
                <CardBody className="py-4 text-center">
                  <Text className="font-medium text-center">{action.label}</Text>
                </CardBody>
              </Card>
            </button>
          ),
        )}
      </div>

      {message && <TextMuted>{message}</TextMuted>}

      <section>
        <SectionHeader label="Pipeline" title="Qualified leads" />
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
                  className="cursor-pointer hover:bg-gtm-bg/60"
                >
                  <TableCell className="font-medium">{lead.company_name}</TableCell>
                  <TableCell className="text-muted">{lead.industry ?? '—'}</TableCell>
                  <TableCell className="text-right">
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
          <Card>
            <CardBody>
              <TextMuted>
                No leads yet. Run <strong className="text-foreground">Discover leads</strong> or start an Outbound Sprint from Marketing.
              </TextMuted>
            </CardBody>
          </Card>
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
                    <li key={factor} className="flex justify-between text-sm border-b border-gtm-border/50 pb-1.5">
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
              <Button variant="secondary" onClick={() => setSelectedLead(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
