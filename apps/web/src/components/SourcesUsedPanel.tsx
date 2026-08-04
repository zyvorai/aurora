'use client';

import { Badge } from '@/components/ui/Badge';
import { Eyebrow, Text, TextSmall } from '@/components/ui/Typography';
import { cn } from '@/lib/cn';

export const MCP_PROVIDER_META: Record<string, { label: string; description: string }> = {
  rag: {
    label: 'Documentation',
    description: 'Vector search over ingested product docs',
  },
  profile: {
    label: 'Product profile',
    description: 'Structured product understanding',
  },
  crm: {
    label: 'CRM pipeline',
    description: 'Open opportunities and deal stages',
  },
  analytics: {
    label: 'Analytics',
    description: '30-day GTM funnel metrics',
  },
  brief: {
    label: 'Executive brief',
    description: 'Summary narrative and risks',
  },
  leads: {
    label: 'Qualified leads',
    description: 'Top scored lead accounts',
  },
};

function providerLabel(id: string): string {
  if (MCP_PROVIDER_META[id]) return MCP_PROVIDER_META[id].label;
  return id.replace(/_/g, ' ');
}

interface SourcesUsedPanelProps {
  sources?: string[];
  className?: string;
  compact?: boolean;
}

export default function SourcesUsedPanel({ sources, className, compact = false }: SourcesUsedPanelProps) {
  if (!sources?.length) return null;

  if (compact) {
    return (
      <div className={cn('flex flex-wrap gap-1.5 mt-2', className)}>
        {sources.map((id) => (
          <Badge key={id} variant="default" className="text-[10px] px-2 py-0">
            {providerLabel(id)}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('mt-4 pt-4 border-t border-gtm-border', className)}>
      <Eyebrow className="mb-3">Context sources</Eyebrow>
      <ul className="grid sm:grid-cols-2 gap-2">
        {sources.map((id) => {
          const meta = MCP_PROVIDER_META[id];
          return (
            <li
              key={id}
              className="rounded-md border border-gtm-border bg-gtm-bg/50 px-3 py-2 text-body-sm"
            >
              <Text className="font-medium text-gtm-accent">{providerLabel(id)}</Text>
              {meta?.description && (
                <TextSmall className="mt-0.5">{meta.description}</TextSmall>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
