'use client';

import { useEffect, useMemo, useState } from 'react';
import { agents, type AgentRegistryEntry } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { PageHero } from '@/components/layout/PageHero';
import { KpiStrip, WorkspacePage, WorkspacePanel } from '@/components/layout/WorkspacePanel';
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

  const stats = useMemo(() => {
    const implemented = entries.filter((e) => e.implemented).length;
    const asyncCount = entries.filter((e) => e.async_required).length;
    return [
      { label: 'Total agents', value: entries.length },
      { label: 'Implemented', value: implemented },
      { label: 'Async', value: asyncCount },
      { label: 'Pending', value: entries.length - implemented },
    ];
  }, [entries]);

  const grouped = useMemo(() => {
    const tiers = new Map<string, AgentRegistryEntry[]>();
    for (const entry of entries) {
      const list = tiers.get(entry.compute_tier) ?? [];
      list.push(entry);
      tiers.set(entry.compute_tier, list);
    }
    return [...tiers.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  return (
    <div className="max-w-container-app mx-auto px-[var(--hs-gutter)] py-10">
      <WorkspacePage>
        <PageHero
          eyebrow="Platform"
          title="Agents"
          description="Every agent in the platform, its compute tier, and implementation status."
        />

        {!loading && entries.length > 0 ? <KpiStrip items={stats} /> : null}

        {loading ? (
          <SkeletonTable />
        ) : (
          grouped.map(([tier, tierEntries]) => (
            <WorkspacePanel key={tier} title={tier} description={`${tierEntries.length} agents`} bodyClassName="divide-y divide-border">
              {tierEntries.map((a) => (
                <div key={a.agent_id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-foreground tracking-[-0.01em]">{a.display_name}</p>
                    <TextSmall className="mt-0.5 block text-[13px]">{a.description}</TextSmall>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted">{a.async_required ? 'Async' : 'Sync'}</span>
                    <span className="text-[11px] text-muted truncate max-w-[8rem]">{a.model_key}</span>
                    <Badge variant={a.implemented ? 'success' : 'warning'}>
                      {a.implemented ? 'Live' : 'Planned'}
                    </Badge>
                  </div>
                </div>
              ))}
            </WorkspacePanel>
          ))
        )}
      </WorkspacePage>
    </div>
  );
}
