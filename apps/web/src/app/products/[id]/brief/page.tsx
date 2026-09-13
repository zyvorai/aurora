'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';
import { products, type ExecutiveBrief, type ProductInsights, type AttributionSummary } from '@/lib/api';
import { useProduct } from '@/context/ProductContext';
import { PageHero } from '@/components/layout/PageHero';
import { KpiStrip, WorkspacePage, WorkspacePanel } from '@/components/layout/WorkspacePanel';
import ExecutiveBriefView from '@/components/ExecutiveBriefView';
import InsightsPanel from '@/components/InsightsPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { TextSmall, StatGrid } from '@/components/ui/Typography';
import { SkeletonText } from '@/components/ui/Skeleton';

export default function BriefPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { product } = useProduct();
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null);
  const [insights, setInsights] = useState<ProductInsights | null>(null);
  const [attribution, setAttribution] = useState<AttributionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadInsights = useCallback(() => {
    products.insights(id).then(setInsights).catch(() => setInsights(null));
    products.attribution(id).then(setAttribution).catch(() => setAttribution(null));
  }, [id]);

  useEffect(() => {
    products.brief(id).then(setBrief).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load brief'));
    loadInsights();
  }, [id, loadInsights]);

  async function handleRefreshInsights() {
    setRefreshing(true);
    try {
      await products.refreshInsights(id);
      loadInsights();
      products.brief(id).then(setBrief).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  const needsSetup = Boolean(brief && !brief.gtm_readiness.profile_built && !brief.gtm_readiness.ingest_complete);

  return (
    <WorkspacePage>
      <PageHero
        eyebrow="Brief"
        title={product?.name ?? 'Product'}
        description={brief?.narrative || 'SQL-first readiness — no LLM at page load.'}
      />

      {error ? <TextSmall className="text-danger">{error}</TextSmall> : null}
      {!brief && !error ? <SkeletonText lines={5} /> : null}

      {brief && !needsSetup ? (
        <KpiStrip
          items={[
            { label: 'Accounts found', value: brief.kpis.accounts_found },
            { label: 'Qualified', value: brief.kpis.qualified },
            { label: 'Conversations', value: brief.kpis.conversations },
            { label: 'Agent runs', value: brief.kpis.agent_runs },
          ]}
        />
      ) : null}

      {needsSetup ? (
        <EmptyState
          icon={Sparkles}
          title="Brief unlocks after your first ingest"
          description="Add a website or docs source in Workspace, run ingest, then come back — KPIs and narrative fill in automatically."
          actions={[{ label: 'Open Workspace', onClick: () => router.push(`/products/${id}`) }]}
        />
      ) : null}

      {brief && !needsSetup ? (
        <WorkspacePanel title="Executive brief">
          <div className="p-4 sm:p-5">
            <ExecutiveBriefView brief={brief} />
          </div>
        </WorkspacePanel>
      ) : null}

      {insights ? (
        <WorkspacePanel title="Intelligence">
          <div className="p-4 sm:p-5">
            <InsightsPanel insights={insights} onRefresh={handleRefreshInsights} refreshing={refreshing} />
          </div>
        </WorkspacePanel>
      ) : null}

      {attribution && attribution.total_touchpoints > 0 ? (
        <WorkspacePanel title="Attribution" description={`${attribution.total_touchpoints} touchpoints · ${attribution.unique_leads} leads`}>
          <StatGrid
            variant="plain"
            className="p-4 sm:p-5"
            items={Object.entries(attribution.by_channel).map(([channel, count]) => ({
              label: channel,
              value: count,
            }))}
          />
        </WorkspacePanel>
      ) : null}

      {brief && !needsSetup && !insights ? (
        <Button variant="secondary" onClick={handleRefreshInsights} disabled={refreshing}>
          Load intelligence
        </Button>
      ) : null}

      {needsSetup ? (
        <div className="text-center">
          <Link
            href={`/products/${id}`}
            className="inline-flex items-center gap-1 text-[var(--accent-blue)] text-[15px] hover:underline"
          >
            Open Workspace <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}
    </WorkspacePage>
  );
}
