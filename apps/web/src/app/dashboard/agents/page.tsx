'use client';

import { useEffect, useState } from 'react';
import { agents, type AgentRegistryEntry } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { PageHero } from '@/components/layout/PageHero';
import { Badge } from '@/components/ui/Badge';
import { TextSmall } from '@/components/ui/Typography';
import { SkeletonTable } from '@/components/ui/Skeleton';

export default function AgentRegistryPage() {
  const [entries, setEntries] = useState<AgentRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agents
      .registry()
      .then(setEntries)
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load agent registry'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-content mx-auto px-6 py-10 space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Platform"
        title="Agents"
        description="Every agent in the platform, its compute tier, and implementation status."
      />

      {loading ? (
        <SkeletonTable />
      ) : (
        <ul className="rounded-[var(--radius-lg)] bg-background divide-y divide-border overflow-hidden list-none m-0 p-0">
          {entries.map((a) => (
            <li key={a.agent_id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-foreground">{a.display_name}</p>
                <TextSmall className="mt-0.5 block">{a.description}</TextSmall>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Badge variant="default">{a.compute_tier}</Badge>
                <span className="text-[12px] text-muted">{a.async_required ? 'Async' : 'Sync'}</span>
                <span className="text-[12px] text-muted truncate max-w-[10rem]">{a.model_key}</span>
                <Badge variant={a.implemented ? 'success' : 'warning'}>
                  {a.implemented ? 'Implemented' : 'Not built'}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
