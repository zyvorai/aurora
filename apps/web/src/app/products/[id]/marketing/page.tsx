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
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import CampaignsPanel from '@/components/campaigns/CampaignsPanel';
import { SectionTitle, Text, TextMuted, TextSmall } from '@/components/ui/Typography';
import { WORKSPACE_ICONS, WORKSPACE_COLORS } from '@/lib/nav-data';

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
    <div className="space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Marketing"
        title="Marketing Studio"
        description="Strategy and campaigns run in the background — your browser won't block."
        icon={WORKSPACE_ICONS.marketing}
        accent={WORKSPACE_COLORS.marketing}
      />

      {brief && (
        <Card elevated>
          <CardBody className="flex items-center justify-between">
            <div>
              <SectionTitle as="h3" className="text-title">GTM strategy</SectionTitle>
              <TextSmall className="mt-1">Market research and ICP readiness</TextSmall>
            </div>
            <Badge variant={brief.gtm_readiness.strategy_ready ? 'success' : 'warning'}>
              {brief.gtm_readiness.strategy_ready ? 'Ready' : 'Not generated'}
            </Badge>
          </CardBody>
        </Card>
      )}

      <section>
        <SectionHeader
          label="Featured workflow"
          title="Outbound Sprint"
          description="One workflow chains the whole outbound motion: product → market research → ICP → discover → qualify → campaign."
        />
        <Card elevated className="max-w-xl">
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
              {['product', 'market research', 'ICP', 'discover', 'qualify', 'campaign'].map((step, i) => (
                <span key={step} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-muted">→</span>}
                  <span
                    className={
                      i === 0
                        ? 'px-2 py-0.5 rounded-[5px] border border-success/30 bg-success/10 text-success'
                        : 'px-2 py-0.5 rounded-[5px] border border-border bg-background text-muted'
                    }
                  >
                    {step}
                  </span>
                </span>
              ))}
            </div>
            <Button disabled={running} onClick={runOutboundSprint}>
              {running ? 'Running outbound sprint…' : 'Run Outbound Sprint'}
            </Button>
            <TextSmall className="text-muted">Runs continue if you close this tab.</TextSmall>
            {run && (
              <div className="space-y-2">
                <ProgressBar percent={workflowProgressPercent(run)} label={`Status: ${run.status}`} />
                <ul className="space-y-1">
                  {run.steps.map((step) => (
                    <li key={step.name} className="flex items-center justify-between text-body-sm">
                      <span className="text-foreground">{step.name}</span>
                      <Badge variant={step.status === 'failed' ? 'danger' : step.status === 'completed' ? 'success' : 'default'}>
                        {step.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeader label="Tools" title="Content & strategy" />
        <div className="grid sm:grid-cols-2 gap-3">
          <Link href={`/products/${id}?tab=strategy`}>
            <Card elevated className="hover:border-primary/40 transition-colors h-full">
              <CardBody>
                <Text className="font-medium">GTM Strategy</Text>
                <TextMuted className="mt-1">Generate ICP and go-to-market plan →</TextMuted>
              </CardBody>
            </Card>
          </Link>
          <Link href={`/products/${id}?tab=content`}>
            <Card elevated className="hover:border-primary/40 transition-colors h-full">
              <CardBody>
                <Text className="font-medium">Content studio</Text>
                <TextMuted className="mt-1">LinkedIn posts and blog articles →</TextMuted>
              </CardBody>
            </Card>
          </Link>
        </div>
      </section>

      <CampaignsPanel productId={id} />
    </div>
  );
}
