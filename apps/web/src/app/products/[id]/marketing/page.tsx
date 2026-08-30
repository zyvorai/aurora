'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { products, type ExecutiveBrief } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useWorkflowPolling } from '@/lib/useWorkflowPolling';
import { workflowProgressPercent } from '@/lib/workflow-progress';
import { PageHero } from '@/components/layout/PageHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import CampaignsPanel from '@/components/campaigns/CampaignsPanel';
import { Text, TextMuted, TextSmall } from '@/components/ui/Typography';

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
    <div className="space-y-10 animate-fade-up">
      <PageHero
        eyebrow="Marketing"
        title="Marketing"
        description="Strategy and campaigns run in the background — your browser won't block."
        actions={
          <Button disabled={running} onClick={runOutboundSprint}>
            {running ? 'Running…' : 'Run Outbound Sprint'}
          </Button>
        }
      />

      {brief && (
        <div className="flex items-center justify-between gap-4 border-y border-border py-5">
          <div>
            <p className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">GTM strategy</p>
            <p className="mt-1 text-[13px] text-muted">Market research and ICP readiness</p>
          </div>
          <Badge variant={brief.gtm_readiness.strategy_ready ? 'success' : 'warning'}>
            {brief.gtm_readiness.strategy_ready ? 'Ready' : 'Not generated'}
          </Badge>
        </div>
      )}

      <section>
        <SectionHeader
          title="Outbound Sprint"
          description="One workflow: product → market research → ICP → discover → qualify → campaign."
        />
        <div className="rounded-[var(--radius-lg)] bg-surface px-5 py-5 space-y-4 max-w-xl">
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            {['product', 'market research', 'ICP', 'discover', 'qualify', 'campaign'].map((step, i) => (
              <span key={step} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-muted">→</span>}
                <span
                  className={
                    i === 0
                      ? 'px-2 py-0.5 rounded-full bg-success/10 text-success'
                      : 'px-2 py-0.5 rounded-full bg-background text-muted'
                  }
                >
                  {step}
                </span>
              </span>
            ))}
          </div>
          <TextSmall className="text-muted">Runs continue if you close this tab.</TextSmall>
          {run && (
            <div className="space-y-2">
              <ProgressBar percent={workflowProgressPercent(run)} label={`Status: ${run.status}`} />
              <ul className="space-y-1">
                {run.steps.map((step) => (
                  <li key={step.name} className="flex items-center justify-between text-[13px]">
                    <span className="text-foreground">{step.name}</span>
                    <Badge
                      variant={
                        step.status === 'failed' ? 'danger' : step.status === 'completed' ? 'success' : 'default'
                      }
                    >
                      {step.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionHeader title="Content & strategy" />
        <div className="rounded-[var(--radius-lg)] bg-surface divide-y divide-border overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <Text className="font-medium">GTM Strategy</Text>
              <TextMuted className="mt-0.5 block text-[13px]">Generate ICP and go-to-market plan</TextMuted>
            </div>
            <Link href={`/products/${id}?tab=strategy`} className="shrink-0">
              <Button size="sm" variant="secondary">
                Open
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <Text className="font-medium">Content studio</Text>
              <TextMuted className="mt-0.5 block text-[13px]">LinkedIn posts and blog articles</TextMuted>
            </div>
            <Link href={`/products/${id}?tab=content`} className="shrink-0">
              <Button size="sm" variant="secondary">
                Open
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <CampaignsPanel productId={id} />
    </div>
  );
}
