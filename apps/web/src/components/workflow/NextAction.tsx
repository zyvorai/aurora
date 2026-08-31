'use client';

import { Button } from '@/components/ui/Button';
import type { ChainStage, ChainStageId } from '@/lib/chain';
import forgeStyles from './forge.module.css';
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
      <div className={cn(forgeStyles.spotlight, 'text-center sm:text-left')}>
        <h2 className={forgeStyles.spotlightTitle}>Every stage is done</h2>
        <p className={forgeStyles.spotlightBody}>Nothing is waiting on you right now.</p>
      </div>
    );
  }

  const content = CONTENT[stage.id];
  const isRunning = stage.status === 'run';

  return (
    <div
      className={cn(
        forgeStyles.spotlight,
        'flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8',
        isRunning && forgeStyles.spotlightRunning,
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--accent-blue)] mb-1.5">
          {isRunning ? 'In progress' : 'Next up'}
        </p>
        <h2 className={forgeStyles.spotlightTitle}>{content.title}</h2>
        <p className={forgeStyles.spotlightBody}>{content.body}</p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0 items-center">
        {!isRunning && content.altLabel && onAlt && (
          <Button variant="secondary" onClick={onAlt} disabled={loading}>
            {content.altLabel}
          </Button>
        )}
        <Button onClick={onAct} disabled={loading}>
          {isRunning ? 'Watch run log' : content.actLabel}
        </Button>
      </div>
    </div>
  );
}
