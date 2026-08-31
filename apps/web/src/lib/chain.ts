import type { ExecutiveBrief } from '@/lib/api';

export type ChainStageId =
  | 'sources'
  | 'ingest'
  | 'profile'
  | 'strategy'
  | 'discover'
  | 'qualify'
  | 'outreach'
  | 'proposal'
  | 'publish';

export type ChainStatus = 'idle' | 'need' | 'run' | 'done';

export interface ChainStageMeta {
  id: ChainStageId;
  label: string;
  unit: string;
}

export const CHAIN: ChainStageMeta[] = [
  { id: 'sources', label: 'Sources', unit: 'added' },
  { id: 'ingest', label: 'Ingest', unit: 'complete' },
  { id: 'profile', label: 'Product profile', unit: 'built' },
  { id: 'strategy', label: 'Strategy', unit: 'ready' },
  { id: 'discover', label: 'Discover', unit: 'accounts' },
  { id: 'qualify', label: 'Qualify', unit: 'leads' },
  { id: 'outreach', label: 'Outreach', unit: 'sent' },
  { id: 'proposal', label: 'Proposal', unit: 'drafts' },
  { id: 'publish', label: 'Publish', unit: 'assets' },
];

export interface ChainStage extends ChainStageMeta {
  status: ChainStatus;
}

/** Which readiness field on `ExecutiveBrief.gtm_readiness` marks a stage done.
 * `sources` uses `ingest_started` (readiness has no separate "a source exists"
 * flag) and `ingest` uses `ingest_complete`. */
function isStageDone(id: ChainStageId, readiness: ExecutiveBrief['gtm_readiness']): boolean {
  switch (id) {
    case 'sources':
      return readiness.ingest_started;
    case 'ingest':
      return readiness.ingest_complete;
    case 'profile':
      return readiness.profile_built;
    case 'strategy':
      return readiness.strategy_ready;
    case 'discover':
      return readiness.discover_ready;
    case 'qualify':
      return readiness.qualify_ready;
    case 'outreach':
      return readiness.outreach_ready;
    case 'proposal':
      return readiness.proposal_ready;
    case 'publish':
      return readiness.publish_ready;
  }
}

/**
 * Derive each stage's status from real readiness data -- never hand-set per
 * screen. `runningStageId` lets the page currently driving a stage (e.g. an
 * active ingest poll) show it as "run" instead of "need"; the run-log dock's
 * broader activity list is informational and doesn't feed this directly,
 * since WorkflowRun.workflow_name doesn't map 1:1 onto every chain stage.
 */
export function deriveChain(
  readiness: ExecutiveBrief['gtm_readiness'] | undefined,
  runningStageId?: ChainStageId | null,
): ChainStage[] {
  if (!readiness) {
    return CHAIN.map((stage, i) => ({ ...stage, status: i === 0 ? 'need' : 'idle' }));
  }
  // Sequential pipeline: a stage is only "done" when it and every prior stage
  // are ready. Otherwise seed/demo artifacts (e.g. outreach without strategy)
  // make later dots green while Next up still asks for an earlier step.
  let blocked = false;
  return CHAIN.map((stage) => {
    const ready = isStageDone(stage.id, readiness);
    if (!blocked && ready) return { ...stage, status: 'done' as ChainStatus };
    if (!blocked) {
      blocked = true;
      if (stage.id === runningStageId) return { ...stage, status: 'run' as ChainStatus };
      return { ...stage, status: 'need' as ChainStatus };
    }
    if (stage.id === runningStageId) return { ...stage, status: 'run' as ChainStatus };
    return { ...stage, status: 'idle' as ChainStatus };
  });
}

export function nextActionableStage(stages: ChainStage[]): ChainStage | null {
  return stages.find((s) => s.status === 'need' || s.status === 'run') ?? null;
}

const RUN_GERUND: Partial<Record<ChainStageId, string>> = {
  ingest: 'ingesting',
  profile: 'building profile',
  strategy: 'generating strategy',
  outreach: 'drafting outreach',
  proposal: 'drafting proposal',
};

/** Overall product state for the Workspace header badge -- "needs sources",
 * "ingesting", "ready", etc. -- derived the same way as every other chain
 * label, never hand-set. */
export function chainStatusLabel(stages: ChainStage[]): string {
  const next = nextActionableStage(stages);
  if (!next) return 'ready';
  if (next.status === 'run') return RUN_GERUND[next.id] ?? `running ${next.label.toLowerCase()}`;
  return `needs ${next.label.toLowerCase()}`;
}

/** Where clicking a chain stage (in the rail or the Workspace overview stepper)
 * should navigate. sources/ingest/profile stay on Workspace Overview (which
 * already renders the sources panel); the rest route to the page/tab that
 * already owns that stage's action. */
export function chainStageHref(productId: string, stageId: ChainStageId): string {
  switch (stageId) {
    case 'sources':
    case 'ingest':
    case 'profile':
      return `/products/${productId}`;
    case 'strategy':
      return `/products/${productId}?tab=strategy`;
    case 'discover':
    case 'qualify':
      return `/products/${productId}/sales`;
    case 'outreach':
      return `/products/${productId}?tab=outreach`;
    case 'proposal':
      return `/products/${productId}?tab=proposal`;
    case 'publish':
      return `/products/${productId}?tab=publish`;
  }
}
