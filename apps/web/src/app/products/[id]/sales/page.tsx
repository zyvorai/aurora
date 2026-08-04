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
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/Table';
import { Stat, Text, TextMuted, TextSmall } from '@/components/ui/Typography';

export default function SalesPage() {
  const { id } = useParams<{ id: string }>();
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null);
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
                <TableRow key={lead.account_id}>
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
    </div>
  );
}
