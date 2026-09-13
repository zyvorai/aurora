'use client';

import ProductProfileView from './ProductProfileView';
import SourcesUsedPanel from './SourcesUsedPanel';
import { SourceLink } from '@/components/sources/SourceLink';
import { Eyebrow, Stat, SubsectionTitle, TextMuted, TextSmall } from '@/components/ui/Typography';
import { Markdown } from '@/components/ui/Markdown';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import { sanitizeWorkflowError } from '@/lib/workflow-errors';

type Result = Record<string, unknown>;

function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gtm-card border border-gtm-border rounded-lg p-5 ${className}`}>
      {title && <SubsectionTitle className="mb-4">{title}</SubsectionTitle>}
      {children}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <Card title="Something went wrong">
      <div className="flex gap-3 items-start rounded-md bg-danger/10 border border-danger/30 p-4">
        <span className="text-danger text-lg leading-none">!</span>
        <p className="text-sm text-danger leading-relaxed">{message}</p>
      </div>
    </Card>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? 'border-gtm-accent/40 bg-gtm-accent/5' : 'border-gtm-border bg-gtm-bg/50'
      }`}
    >
      <Stat label={label} value={value} highlight={highlight} />
    </div>
  );
}

function CitationsList({ citations }: { citations: Array<{ chunk_id?: string; document_title?: string; excerpt?: string; url?: string }> }) {
  if (!citations?.length) return null;
  return (
    <div className="mt-4 pt-4 border-t border-gtm-border">
      <Eyebrow className="mb-3">Sources</Eyebrow>
      <ul className="space-y-2">
        {citations.map((c, i) => (
          <li key={c.chunk_id ?? i} className="text-sm rounded-md bg-gtm-bg border border-gtm-border p-3">
            <p className="font-medium text-gtm-accent">{c.document_title || 'Document'}</p>
            {c.excerpt && <p className="text-muted mt-1 line-clamp-2">{c.excerpt}</p>}
            {Boolean(c.url) && (
              <div className="mt-1.5">
                <SourceLink urlOrKey={c.url} variant="compact" />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalyticsView({ data }: { data: Result }) {
  const funnel = (data.funnel as Record<string, number>) || {};
  const funnelSteps = [
    { key: 'visitors', label: 'Visitors' },
    { key: 'content_views', label: 'Content views' },
    { key: 'conversations', label: 'Conversations' },
    { key: 'qualified_leads', label: 'Qualified leads' },
    { key: 'artifacts_created', label: 'Artifacts' },
    { key: 'agent_runs', label: 'Agent runs' },
  ];
  const topQuestions = (data.top_questions as Array<{ question: string }>) || [];
  const knowledgeGaps = (data.knowledge_gaps as Array<{ query: string }>) || [];
  const metrics = (data.metrics as Record<string, number>) || {};
  const maxFunnel = Math.max(...funnelSteps.map((s) => funnel[s.key] ?? 0), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Analytics</h3>
        <Badge>Period: {String(data.period || '—')}</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {funnelSteps.map((step) => (
          <StatCard
            key={step.key}
            label={step.label}
            value={funnel[step.key] ?? 0}
            highlight={step.key === 'artifacts_created' && (funnel[step.key] ?? 0) > 0}
          />
        ))}
      </div>

      <Card title="Conversion funnel">
        <div className="space-y-3">
          {funnelSteps.map((step) => {
            const val = funnel[step.key] ?? 0;
            const pct = maxFunnel > 0 ? Math.round((val / maxFunnel) * 100) : 0;
            return (
              <div key={step.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted">{step.label}</span>
                  <span className="font-medium tabular-nums">{val}</span>
                </div>
                <div className="h-2 rounded-full bg-gtm-bg overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gtm-accent/80 to-gtm-accent transition-all"
                    style={{ width: `${Math.max(pct, val > 0 ? 8 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {Object.keys(metrics).length > 0 && (
        <Card title="Event metrics">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(metrics).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gtm-border/50 pb-2">
                <dt className="text-muted capitalize">{k.replace(/_/g, ' ')}</dt>
                <dd className="font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card title="Top questions">
          {topQuestions.length ? (
            <ul className="space-y-2 text-sm">
              {topQuestions.map((q, i) => (
                <li key={i} className="flex gap-2 text-muted">
                  <span className="text-gtm-accent font-mono text-xs">{i + 1}.</span>
                  {q.question}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No queries recorded yet.</p>
          )}
        </Card>
        <Card title="Knowledge gaps">
          {knowledgeGaps.length ? (
            <ul className="space-y-2 text-sm">
              {knowledgeGaps.map((g, i) => (
                <li key={i} className="flex gap-2 text-warning">
                  <span className="text-warning">?</span>
                  {g.query}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No ungrounded blocks detected.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function StrategyView({ data }: { data: Result }) {
  const personas = (data.personas as Array<Record<string, unknown>>) || [];
  const calendar = (data.content_calendar as Array<Record<string, unknown>>) || [];
  const objections = (data.objection_handling as Array<Record<string, unknown>>) || [];
  const keywords = (data.seo_keywords as string[]) || [];
  const valueProps = (data.value_propositions as string[]) || [];
  const messaging = data.messaging_hierarchy as Record<string, unknown> | undefined;
  const sources = (data.sources_used as string[]) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">GTM Strategy</h3>
        {Boolean(data.artifact_id) && <Badge>Artifact saved</Badge>}
      </div>
      <SourcesUsedPanel sources={sources} className="mt-0 pt-0 border-0" />

      {Boolean(data.gtm_strategy) && (
        <Card title="Strategy overview">
          <Markdown>{String(data.gtm_strategy)}</Markdown>
        </Card>
      )}
      {Boolean(data.icp) && (
        <Card title="Ideal customer profile">
          <Markdown>{String(data.icp)}</Markdown>
        </Card>
      )}
      {Boolean(data.positioning) && (
        <Card title="Positioning">
          <p className="text-sm font-medium text-gtm-accent">{String(data.positioning)}</p>
        </Card>
      )}
      {personas.length > 0 && (
        <Card title="Personas">
          <div className="grid sm:grid-cols-2 gap-3">
            {personas.map((persona, i) => (
              <div key={i} className="rounded-md border border-gtm-border bg-gtm-bg p-4 space-y-2">
                <p className="font-semibold">{String(persona.name || persona.title || `Persona ${i + 1}`)}</p>
                {Boolean(persona.title) && Boolean(persona.name) && (
                  <p className="text-xs text-muted">{String(persona.title)}</p>
                )}
                {Array.isArray(persona.pain_points) && (
                  <ul className="text-xs text-muted list-disc list-inside">
                    {(persona.pain_points as string[]).slice(0, 4).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
      {messaging && Object.keys(messaging).length > 0 && (
        <Card title="Messaging hierarchy">
          <dl className="space-y-2 text-sm">
            {Object.entries(messaging).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase text-gtm-accent">{k.replace(/_/g, ' ')}</dt>
                <dd className="text-muted mt-0.5">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
      {valueProps.length > 0 && (
        <Card title="Value propositions">
          <ul className="list-disc list-inside text-sm space-y-1 text-muted">
            {valueProps.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </Card>
      )}
      {keywords.length > 0 && (
        <Card title="SEO keywords">
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <span key={kw} className="px-2 py-1 text-xs rounded bg-gtm-bg border border-gtm-border">
                {kw}
              </span>
            ))}
          </div>
        </Card>
      )}
      {objections.length > 0 && (
        <Card title="Objection handling">
          <div className="space-y-3">
            {objections.map((o, i) => (
              <div key={i} className="text-sm border-l-2 border-gtm-accent/50 pl-3">
                <p className="font-medium">{String(o.objection || o.question)}</p>
                <p className="text-muted mt-1">{String(o.response || o.answer)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
      {calendar.length > 0 && (
        <Card title="Content calendar">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Week</TableHeaderCell>
                <TableHeaderCell>Topic</TableHeaderCell>
                <TableHeaderCell>Channel</TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calendar.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{String(row.week ?? i + 1)}</TableCell>
                  <TableCell>{String(row.topic ?? '—')}</TableCell>
                  <TableCell>{String(row.channel ?? '—')}</TableCell>
                  <TableCell>{String(row.content_type ?? '—')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function QueryView({ data }: { data: Result }) {
  const citations = (data.citations as Array<{ chunk_id?: string; document_title?: string; excerpt?: string; url?: string }>) || [];
  const sources = (data.sources_used as string[]) || [];
  return (
    <Card title="Answer">
      <div className="flex gap-2 mb-3 flex-wrap">
        <Badge variant={data.grounded ? 'success' : 'warning'}>
          {data.grounded ? 'Grounded' : 'Low confidence'}
        </Badge>
        {typeof data.confidence === 'number' && (
          <Badge>{Math.round((data.confidence as number) * 100)}% confidence</Badge>
        )}
      </div>
      <Markdown>{String(data.answer)}</Markdown>
      <SourcesUsedPanel sources={sources} />
      <CitationsList citations={citations} />
    </Card>
  );
}

function ContentView({ data }: { data: Result }) {
  return (
    <Card title={String(data.title || 'Generated content')}>
      <div className="flex gap-2 mb-3">
        <Badge variant={data.grounded ? 'success' : 'warning'}>{data.grounded ? 'Grounded' : 'Draft'}</Badge>
        <Badge>{String(data.status || 'draft')}</Badge>
      </div>
      <Markdown>{String(data.content)}</Markdown>
      <CitationsList citations={(data.citations as []) || []} />
    </Card>
  );
}

function OutreachView({ data }: { data: Result }) {
  const followUps = (data.follow_up_sequence as Array<Record<string, unknown>>) || [];
  return (
    <div className="space-y-4">
      <Card title={`Outreach — ${String(data.company_name || 'Prospect')}`}>
        {Boolean(data.product_fit) && (
          <div className="mb-4">
            <Markdown>{String(data.product_fit)}</Markdown>
          </div>
        )}
        {Array.isArray(data.pain_points) && (data.pain_points as string[]).length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs uppercase text-gtm-accent mb-2">Likely pain points</h4>
            <ul className="list-disc list-inside text-sm text-muted">
              {(data.pain_points as string[]).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        <h4 className="text-xs uppercase text-gtm-accent mb-2">Email draft</h4>
        <div className="rounded-md bg-gtm-bg border border-gtm-border p-4">
          <Markdown>{String(data.email_draft)}</Markdown>
        </div>
      </Card>
      {followUps.length > 0 && (
        <Card title="Follow-up sequence">
          <div className="space-y-3">
            {followUps.map((f, i) => (
              <div key={i} className="border border-gtm-border rounded-md p-3">
                <p className="text-xs text-gtm-accent">Day {String(f.day ?? i + 1)} — {String(f.subject ?? '')}</p>
                <div className="mt-2">
                  <Markdown className="text-sm">{String(f.body ?? '')}</Markdown>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ArchitectView({ data }: { data: Result }) {
  const sources = (data.sources_used as string[]) || [];
  return (
    <div className="space-y-4">
      <Card title="Solution architect">
        <div className="mb-3">
          <Badge variant={data.grounded ? 'success' : 'warning'}>
            {data.grounded ? 'Grounded' : 'Review needed'}
          </Badge>
        </div>
        <Markdown>{String(data.answer)}</Markdown>
        <SourcesUsedPanel sources={sources} />
        <CitationsList citations={(data.citations as []) || []} />
      </Card>
      {Boolean(data.deployment_plan) && (
        <Card title="Deployment plan">
          <Markdown>{String(data.deployment_plan)}</Markdown>
        </Card>
      )}
      {'security_notes' in data && Boolean(data.security_notes) && (
        <Card title="Security considerations">
          <Markdown>{String(data.security_notes)}</Markdown>
        </Card>
      )}
      {Boolean(data.architecture_diagram) && (
        <Card title="Architecture (Mermaid)">
          <pre className="text-xs font-mono bg-gtm-bg p-4 rounded overflow-x-auto text-muted">
            {String(data.architecture_diagram)}
          </pre>
        </Card>
      )}
    </div>
  );
}

function ProposalView({ data }: { data: Result }) {
  const sources = (data.sources_used as string[]) || [];
  const sections = [
    { key: 'proposal_content', title: 'Proposal' },
    { key: 'sow', title: 'Statement of work' },
    { key: 'roi_analysis', title: 'ROI analysis' },
    { key: 'pricing', title: 'Pricing' },
    { key: 'timeline', title: 'Timeline' },
  ];
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{String(data.title || 'Proposal')}</h3>
      <SourcesUsedPanel sources={sources} className="mt-0 pt-0 border-0" />
      {sections.map(({ key, title }) =>
        data[key] ? (
          <Card key={key} title={title}>
            <Markdown>{String(data[key])}</Markdown>
          </Card>
        ) : null,
      )}
    </div>
  );
}

function JobStatusView({ data }: { data: Result }) {
  const ok = data.status === 'completed' || data.status === 'ready';
  return (
    <Card title={ok ? 'Completed' : 'Status'}>
      <div className={`flex gap-3 items-center rounded-md p-4 border ${ok ? 'bg-success/10 border-success/30' : 'bg-gtm-bg border-gtm-border'}`}>
        <span className={`text-2xl ${ok ? 'text-success' : 'text-gtm-accent'}`}>{ok ? '✓' : '…'}</span>
        <div>
          <p className="font-medium">{String(data.message || data.status || 'Done')}</p>
          {Boolean(data.job_id) && <p className="text-xs text-muted mt-1">Job {String(data.job_id)}</p>}
        </div>
      </div>
    </Card>
  );
}

export default function ResultPanel({ result }: { result: Result }) {
  if ('error' in result && result.error) {
    return <ErrorBanner message={sanitizeWorkflowError(String(result.error))} />;
  }

  if ('funnel' in result && 'period' in result) {
    return <AnalyticsView data={result} />;
  }

  if ('gtm_strategy' in result) {
    return <StrategyView data={result} />;
  }

  if ('deployment_plan' in result || 'architecture_diagram' in result) {
    return <ArchitectView data={result} />;
  }

  if ('answer' in result && !('reply' in result)) {
    return <QueryView data={result} />;
  }

  if ('content' in result && 'artifact_id' in result) {
    return <ContentView data={result} />;
  }

  if ('email_draft' in result) {
    return <OutreachView data={result} />;
  }

  if ('proposal_content' in result) {
    return <ProposalView data={result} />;
  }

  if ('profile' in result && result.status === 'ready') {
    return (
      <Card title="Product profile ready">
        <ProductProfileView profile={(result.profile as Record<string, unknown>) || {}} />
      </Card>
    );
  }

  if ('message' in result && ('job_id' in result || 'status' in result)) {
    return <JobStatusView data={result} />;
  }

  return (
    <Card title="Result">
      <p className="text-sm text-muted">Action completed successfully.</p>
    </Card>
  );
}
