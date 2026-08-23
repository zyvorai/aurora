import { ArrowUpRight, Loader2, Play } from 'lucide-react';
import type { StageBlock } from '@/lib/api';
import { Markdown } from '@/components/ui/Markdown';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextMuted } from '@/components/ui/Typography';
import { STAGE_ACTION_LABELS, type ALLOWED_STAGE_ACTIONS } from '@/lib/stage-icons';
import { cn } from '@/lib/cn';

/** Renders a tenant-defined custom stage's static content blocks (markdown/link/
 * callout). The `agent_action` block (at most one per stage) is rendered separately
 * by ForgePage via the existing runAction/AgentTaskProgress/ResultPanel machinery --
 * this component only shows the "Run" trigger for it, not its result. */
export function StageBlockRenderer({
  blocks,
  onRunAction,
  running,
}: {
  blocks: StageBlock[];
  onRunAction: (action: string, params: Record<string, string>) => void;
  running: boolean;
}) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'markdown':
            return (
              <Card key={i}>
                <CardBody>
                  <Markdown>{block.body}</Markdown>
                </CardBody>
              </Card>
            );
          case 'link':
            return (
              <a
                key={i}
                href={block.href}
                target={block.href.startsWith('/') ? undefined : '_blank'}
                rel={block.href.startsWith('/') ? undefined : 'noopener noreferrer'}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border',
                  'bg-surface px-4 py-3 text-body-sm font-medium text-foreground hover:border-primary/40 transition-colors',
                )}
              >
                {block.label}
                <ArrowUpRight className="w-4 h-4 text-muted shrink-0" aria-hidden />
              </a>
            );
          case 'callout':
            return (
              <Card key={i} elevated>
                <CardBody>
                  <p className="text-xs font-medium uppercase tracking-eyebrow text-muted mb-1">{block.label}</p>
                  <p className="text-stat-value font-semibold text-foreground">{block.value}</p>
                  {block.description && <TextMuted className="mt-1">{block.description}</TextMuted>}
                </CardBody>
              </Card>
            );
          case 'agent_action': {
            const actionLabel = STAGE_ACTION_LABELS[block.action as (typeof ALLOWED_STAGE_ACTIONS)[number]] ?? block.action;
            return (
              <Card key={i} elevated>
                <CardBody className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{block.label || actionLabel}</p>
                    <TextMuted className="mt-0.5">{actionLabel}</TextMuted>
                  </div>
                  <Button onClick={() => onRunAction(block.action, block.params)} disabled={running}>
                    {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Run
                  </Button>
                </CardBody>
              </Card>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
