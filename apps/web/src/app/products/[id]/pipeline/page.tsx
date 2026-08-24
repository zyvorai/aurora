'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  OPPORTUNITY_STAGES,
  products,
  type Opportunity,
  type PipelineSummary,
  type WorkflowRunStatus,
} from '@/lib/api';
import { PageHero } from '@/components/layout/PageHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Kanban } from 'lucide-react';
import { WORKSPACE_ICONS, WORKSPACE_COLORS } from '@/lib/nav-data';
import { showToast } from '@/lib/toast';
import { workflowProgressPercent } from '@/lib/workflow-progress';
import AccountHealthPanel from '@/components/success/AccountHealthPanel';
import OpportunityDetailModal from '@/components/pipeline/OpportunityDetailModal';
import { Stat, Text, TextMuted, TextSmall } from '@/components/ui/Typography';

const STAGE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  qualification: 'Qualification',
  technical_eval: 'Technical Eval',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

export default function PipelinePage() {
  const { id } = useParams<{ id: string }>();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowRunStatus | null>(null);
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);

  const load = useCallback(() => {
    products.opportunities(id).then((data) => setOpportunities(Array.isArray(data) ? data : [])).catch(() => setOpportunities([]));
    products.pipelineSummary(id).then(setSummary).catch(() => setSummary(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStageChange(oppId: string, stage: string) {
    try {
      await products.updateOpportunityStage(id, oppId, stage);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Stage update failed');
    }
  }

  async function runTechnicalEval() {
    setLoading(true);
    setMessage(null);
    setWorkflowStatus(null);
    try {
      const accepted = await products.startTechnicalEval(id, {
        opportunity_name: 'Technical Eval Deal',
        company: 'Prospect Co',
        question: 'How would we deploy this product in a regulated fintech environment?',
        scope: 'Enterprise deployment for 500 users with SSO and audit logging',
        include_pricing: true,
      });
      setMessage(`Technical eval queued — polling ${accepted.workflow_run_id.slice(0, 8)}…`);

      const poll = async () => {
        const run = await products.pollWorkflow(accepted.workflow_run_id);
        setWorkflowStatus(run);
        if (run.status === 'queued' || run.status === 'running') {
          setTimeout(poll, 3000);
        } else {
          load();
          const doneMessage = run.status === 'completed'
            ? 'Technical eval complete — opportunity at Proposal stage'
            : (run.error_message ?? 'Workflow failed');
          setMessage(doneMessage);
          showToast(run.status === 'completed' ? 'success' : 'error', doneMessage);
          setLoading(false);
        }
      };
      setTimeout(poll, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Technical eval failed';
      setMessage(errorMessage);
      showToast('error', errorMessage);
      setLoading(false);
    }
  }

  async function createManualOpp() {
    setLoading(true);
    try {
      await products.createOpportunity(id, {
        name: 'New Opportunity',
        company: 'Manual Entry',
        stage: 'discovery',
      });
      load();
      setMessage('Opportunity created');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setLoading(false);
    }
  }

  const byStage = OPPORTUNITY_STAGES.reduce<Record<string, Opportunity[]>>((acc, stage) => {
    acc[stage] = opportunities.filter((o) => o.stage === stage);
    return acc;
  }, {});

  const openOldestDays = opportunities
    .filter((o) => o.stage !== 'closed_won' && o.stage !== 'closed_lost' && o.created_at)
    .reduce<number | null>((oldest, o) => {
      const days = Math.floor((Date.now() - new Date(o.created_at as string).getTime()) / 86_400_000);
      return oldest === null || days > oldest ? days : oldest;
    }, null);

  return (
    <div className="space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Revenue"
        title="Pipeline"
        description="Drag a card to move a stage. Technical evals run in the background and post their verdict back to the card."
        icon={WORKSPACE_ICONS.pipeline}
        accent={WORKSPACE_COLORS.pipeline}
        actions={
          <>
            <Button variant="secondary" disabled={loading} onClick={createManualOpp}>
              New opportunity
            </Button>
            <Button disabled={loading} onClick={runTechnicalEval}>
              Run technical eval
            </Button>
          </>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Open deals', value: summary.total },
            { label: 'Weighted pipeline', value: `$${summary.weighted_pipeline.toLocaleString()}` },
            { label: 'At proposal', value: summary.by_stage.proposal ?? 0 },
            { label: 'Oldest', value: openOldestDays === null ? '—' : `${openOldestDays}d` },
          ].map((s) => (
            <Card key={s.label} elevated>
              <CardBody className="py-4">
                <Stat label={s.label} value={s.value} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {message && <TextMuted>{message}</TextMuted>}

      {workflowStatus && workflowStatus.status !== 'completed' && (
        <Card>
          <CardBody className="space-y-3">
            <ProgressBar percent={workflowProgressPercent(workflowStatus)} label={`Workflow: ${workflowStatus.status}`} />
            <ul className="space-y-1">
              {workflowStatus.steps.map((step) => (
                <li key={step.name} className="flex items-center justify-between">
                  <TextSmall>
                    {step.name}
                    {step.error ? ` — ${step.error}` : ''}
                  </TextSmall>
                  <Badge variant={step.status === 'failed' ? 'danger' : step.status === 'completed' ? 'success' : 'default'}>
                    {step.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <section>
        <SectionHeader
          label="Kanban"
          title="Opportunities by stage"
          action={
            <Link href={`/products/${id}/sales`} className="text-body-sm text-primary hover:underline">
              ← Leads
            </Link>
          }
        />
        <div className="overflow-x-auto pb-4 -mx-2 px-2">
          <div className="flex gap-3 min-w-max">
            {OPPORTUNITY_STAGES.map((stage) => (
              <Card key={stage} className="w-52 shrink-0">
                <CardHeader className="py-2">
                  <TextSmall className="font-medium text-muted">
                    {STAGE_LABELS[stage] ?? stage}
                    <span className="ml-1 opacity-60">({byStage[stage]?.length ?? 0})</span>
                  </TextSmall>
                </CardHeader>
                <CardBody className="p-2 space-y-2 min-h-[120px]">
                  {(byStage[stage] ?? []).map((opp) => (
                    <div
                      key={opp.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedOppId(opp.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setSelectedOppId(opp.id); }}
                      className="rounded-[var(--radius-liquid)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-2 text-body-sm cursor-pointer hover:border-[var(--glass-border-strong)] transition-colors"
                    >
                      <Text className="font-medium truncate">{opp.name}</Text>
                      {opp.company && (
                  <TextSmall className="truncate">{opp.company}</TextSmall>
                      )}
                      <select
                        className="mt-2 w-full text-body-sm bg-transparent border border-border rounded px-1 py-0.5 focus-ring"
                        value={opp.stage}
                        onChange={(e) => handleStageChange(opp.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Stage for ${opp.name}`}
                      >
                        {OPPORTUNITY_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
        {opportunities.length === 0 && (
          <EmptyState
            icon={Kanban}
            title="No opportunities yet"
            description="Create one manually, or run a technical eval workflow to generate one from a qualified lead."
            actions={[
              { label: 'New opportunity', onClick: createManualOpp, primary: false },
              { label: 'Run technical eval', onClick: runTechnicalEval },
            ]}
            className="mt-4"
          />
        )}
      </section>

      <AccountHealthPanel productId={id} />

      {selectedOppId && (
        <OpportunityDetailModal
          productId={id}
          opportunityId={selectedOppId}
          onClose={() => setSelectedOppId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
