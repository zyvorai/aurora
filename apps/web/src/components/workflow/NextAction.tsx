'use client';

import { Button } from '@/components/ui/Button';
import type { ChainStage, ChainStageId } from '@/lib/chain';

interface NextActionContent {
  title: string;
  body: string;
  actLabel: string;
  altLabel?: string;
}

const CONTENT: Record<ChainStageId, NextActionContent> = {
  sources: {
    title: 'Add your first source',
    body: 'Paste a website URL, docs site, or repo. Ingest unlocks the rest once it finishes.',
    actLabel: 'Add source',
    altLabel: 'Import from GitHub',
  },
  ingest: {
    title: 'Ingest your sources',
    body: 'Crawls and indexes what you added. The product profile can start after ingest finishes.',
    actLabel: 'Crawl & ingest',
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
    body: 'Finds accounts that match the ICP — rules-based, same input, same output every time.',
    actLabel: 'Go to Sales',
  },
  qualify: {
    title: 'Qualify discovered accounts',
    body: 'Scores each account on fit and intent so outreach targets the right ones first.',
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
      <div className="rounded-[var(--radius-lg)] bg-surface px-6 py-7">
        <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-foreground">Every stage is done</h2>
        <p className="mt-2 text-[15px] text-muted leading-[1.47]">Nothing is waiting on you right now.</p>
      </div>
    );
  }

  const content = CONTENT[stage.id];
  const isRunning = stage.status === 'run';

  return (
    <div className="rounded-[var(--radius-lg)] bg-surface px-6 py-7 flex flex-col sm:flex-row sm:items-center gap-5">
      <div className="flex-1 min-w-0">
        <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-foreground">{content.title}</h2>
        <p className="mt-2 text-[15px] text-muted leading-[1.47] max-w-[48ch]">{content.body}</p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {!isRunning && content.altLabel && onAlt && (
          <Button variant="secondary" onClick={onAlt} disabled={loading}>
            {content.altLabel}
          </Button>
        )}
        <Button onClick={onAct} disabled={loading} size="lg">
          {isRunning ? 'Watch run log' : content.actLabel}
        </Button>
      </div>
    </div>
  );
}
