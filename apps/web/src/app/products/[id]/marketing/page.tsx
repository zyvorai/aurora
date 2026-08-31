'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { products, type ExecutiveBrief } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useWorkflowPolling } from '@/lib/useWorkflowPolling';
import { workflowProgressPercent } from '@/lib/workflow-progress';
import { PageHero } from '@/components/layout/PageHero';
import { KpiStrip, WorkspacePage, WorkspacePanel, WorkspaceRow } from '@/components/layout/WorkspacePanel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import CampaignsPanel from '@/components/campaigns/CampaignsPanel';
import { TextSmall } from '@/components/ui/Typography';
import forgeStyles from '@/components/workflow/forge.module.css';
import { cn } from '@/lib/cn';

export default function MarketingPage() {
  const { id } = useParams<{ id: string }>();
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null);
  const [running, setRunning] = useState(false);

  const { run, startPolling } = useWorkflowPolling({
    onComplete: () => {
      setRunning(false);
      showToast('success', 'Outbound sprint complete.');
      products.brief(id).then(setBrief).catch(() => {});
    },
    onError: (message) => {
      setRunning(false);
      showToast('error', message || 'Outbound sprint failed');
    },
  });

  useEffect(() => {
    products.brief(id).then(setBrief).catch(() => {});
  }, [id]);

  async function runOutboundSprint() {
    setRunning(true);
    try {
      const accepted = await products.startOutboundSprint(id, {
        focus_industries: ['fintech', 'healthtech'],
        campaign_name: 'Outbound Sprint',
      });
      startPolling(accepted.workflow_run_id);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to start outbound sprint');
      setRunning(false);
    }
  }

  return (
    <WorkspacePage>
      <PageHero
        eyebrow="Marketing"
        title="Marketing"
        description="Strategy and campaigns run in the background — your browser won't block."
      />

      {brief ? (
        <KpiStrip
          items={[
            { label: 'Strategy', value: brief.gtm_readiness.strategy_ready ? 'Ready' : '—' },
            { label: 'Accounts found', value: brief.kpis.accounts_found },
            { label: 'Qualified', value: brief.kpis.qualified },
            { label: 'Agent runs', value: brief.kpis.agent_runs },
          ]}
        />
      ) : null}

      <div className={cn(forgeStyles.spotlight, running && forgeStyles.spotlightRunning, 'flex flex-col sm:flex-row sm:items-center gap-5')}>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-primary mb-1.5">Outbound sprint</p>
          <h2 className={forgeStyles.spotlightTitle}>Run the full GTM chain</h2>
          <p className={forgeStyles.spotlightBody}>
            Product → market research → ICP → discover → qualify → campaign. Keeps running if you close the tab.
          </p>
        </div>
        <Button disabled={running} onClick={runOutboundSprint} className="shrink-0">
          {running ? 'Running…' : 'Start sprint'}
        </Button>
      </div>

      {run ? (
        <WorkspacePanel title="Sprint progress" bodyClassName="p-4 space-y-3">
          <ProgressBar percent={workflowProgressPercent(run)} label={`Status: ${run.status}`} />
          <ul className="space-y-1.5 m-0 p-0 list-none">
            {run.steps.map((step) => (
              <li key={step.name} className="flex items-center justify-between text-[13px]">
                <span className="text-foreground">{step.name}</span>
                <Badge variant={step.status === 'failed' ? 'danger' : step.status === 'completed' ? 'success' : 'default'}>
                  {step.status}
                </Badge>
              </li>
            ))}
          </ul>
        </WorkspacePanel>
      ) : null}

      <WorkspacePanel title="Content & strategy" description="Open in Workspace to generate">
        <WorkspaceRow
          title="GTM Strategy"
          description="Generate ICP and go-to-market plan"
          actions={
            <Link href={`/products/${id}?tab=strategy`}>
              <Button size="sm" variant="secondary">Open</Button>
            </Link>
          }
        />
        <WorkspaceRow
          title="Content studio"
          description="LinkedIn posts and blog articles"
          actions={
            <Link href={`/products/${id}?tab=content`}>
              <Button size="sm" variant="secondary">Open</Button>
            </Link>
          }
        />
        <WorkspaceRow
          title="Publish"
          description="Review and approve artifacts"
          actions={
            <Link href={`/products/${id}?tab=publish`}>
              <Button size="sm" variant="secondary">Open</Button>
            </Link>
          }
        />
      </WorkspacePanel>

      <CampaignsPanel productId={id} />
    </WorkspacePage>
  );
}
