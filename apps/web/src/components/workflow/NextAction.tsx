'use client';

import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ChainStage, ChainStageId } from '@/lib/chain';
import { cn } from '@/lib/cn';

interface NextActionContent {
  title: string;
  body: string;
  actLabel: string;
  altLabel?: string;
}

const CONTENT: Record<ChainStageId, NextActionContent> = {
  sources: {
    title: 'Add your first source',
    body: 'Paste a website URL, a docs site, or a repo. Ingest unlocks the other eight stages once it finishes.',
    actLabel: 'Add source',
    altLabel: 'Import from GitHub',
  },
  ingest: {
    title: 'Ingest your sources',
    body: 'Crawls and indexes what you added. Product profile starts on its own once ingest finishes — nothing else to click.',
    actLabel: 'Crawl & Ingest',
    altLabel: 'Add another source',
  },
  profile: {
    title: 'Build the product profile',
    body: 'Extracts capabilities, ICP, and value props from what was ingested — everything downstream is grounded in this.',
    actLabel: 'Build profile',
    altLabel: 'Refresh knowledge',
  },
  strategy: {
    title: 'Generate a GTM strategy',
    body: 'ICP, personas, positioning, and a content calendar, built from the product profile.',
    actLabel: 'Generate strategy',
  },
  discover: {
    title: 'Discover accounts',
    body: 'Finds accounts that match the ICP from the strategy — rules-based, same input, same output every time.',
    actLabel: 'Go to Sales',
  },
  qualify: {
    title: 'Qualify discovered accounts',
    body: 'Scores each discovered account on fit and intent so outreach targets the right ones first.',
    actLabel: 'Go to Sales',
  },
  outreach: {
    title: 'Draft outreach',
    body: 'Personalized email and follow-up sequence for a qualified account.',
    actLabel: 'Go to Sales',
  },
  proposal: {
    title: 'Generate a proposal',
    body: 'SOW, ROI analysis, and timeline — grounded in the product profile and strategy.',
    actLabel: 'Go to Marketing',
  },
  publish: {
    title: 'Publish content',
    body: 'Push generated content to your channels — the last stage in the chain.',
    actLabel: 'Go to Marketing',
  },
};

export function NextAction({
  stage,
  onAct,
  onAlt,
  loading,
}: {
  stage: ChainStage | null;
  onAct: () => void;
  onAlt?: () => void;
  loading?: boolean;
}) {
  if (!stage) {
    return (
      <Card elevated className="border-success/30">
        <CardBody>
          <p className="font-semibold text-foreground">Every stage is done</p>
          <p className="mt-1 text-body-sm text-muted">Nothing is waiting on you right now.</p>
        </CardBody>
      </Card>
    );
  }

  const content = CONTENT[stage.id];
  const isRunning = stage.status === 'run';

  return (
    <Card
      elevated
      className={cn('overflow-hidden', isRunning ? 'border-primary/30' : 'border-warning/30')}
    >
      <CardBody className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{content.title}</h2>
          <p className="mt-1 text-body-sm text-muted max-w-[64ch]">{content.body}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {!isRunning && content.altLabel && onAlt && (
            <Button variant="secondary" onClick={onAlt} disabled={loading}>
              {content.altLabel}
            </Button>
          )}
          <Button onClick={onAct} disabled={loading}>
            {isRunning ? 'Watch run log' : content.actLabel}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
