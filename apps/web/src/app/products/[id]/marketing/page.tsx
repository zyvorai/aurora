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
          description="Product → market research → discover → qualify → campaign (async 202 + poll)"
        />
        <Card elevated className="max-w-xl">
          <CardBody className="space-y-4">
            <Button disabled={running} onClick={runOutboundSprint}>
              {running ? 'Running outbound sprint…' : 'Run Outbound Sprint'}
            </Button>
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
