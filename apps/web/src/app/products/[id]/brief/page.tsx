'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';
import { products, type ExecutiveBrief, type ProductInsights } from '@/lib/api';
import { useProduct } from '@/context/ProductContext';
import { PageHero } from '@/components/layout/PageHero';
import ExecutiveBriefView from '@/components/ExecutiveBriefView';
import InsightsPanel from '@/components/InsightsPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { TextSmall } from '@/components/ui/Typography';
import { WORKSPACE_ICONS, WORKSPACE_COLORS } from '@/lib/nav-data';
import { SkeletonText } from '@/components/ui/Skeleton';

export default function BriefPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { product } = useProduct();
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null);
  const [insights, setInsights] = useState<ProductInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadInsights = useCallback(() => {
    products.insights(id).then(setInsights).catch(() => setInsights(null));
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
    <div className="space-y-8 animate-fade-up max-w-content mx-auto px-6 py-8">
      <PageHero
        eyebrow="Executive Brief"
        title={product?.name ?? 'Product'}
        description={brief?.narrative || 'SQL-first readiness dashboard — no LLM at page load.'}
        icon={WORKSPACE_ICONS.brief}
        accent={WORKSPACE_COLORS.brief}
      />
      {error && <TextSmall className="text-danger">{error}</TextSmall>}
      {!brief && !error && <SkeletonText lines={5} />}

      {needsSetup ? (
        <EmptyState
          icon={Sparkles}
          title="Brief unlocks after your first ingest"
          description="Add a website or docs source in Forge, run ingest, then come back — KPIs and narrative fill in automatically."
          actions={[{ label: 'Go to Forge', onClick: () => router.push(`/products/${id}`) }]}
        />
      ) : null}

      {brief && !needsSetup && <ExecutiveBriefView brief={brief} />}
      {insights && (
        <InsightsPanel
          insights={insights}
          onRefresh={handleRefreshInsights}
          refreshing={refreshing}
        />
      )}
      {brief && !needsSetup && !insights && (
        <Button variant="secondary" onClick={handleRefreshInsights} disabled={refreshing}>
          Load intelligence
        </Button>
      )}
      {needsSetup ? (
        <div className="text-center">
          <Link href={`/products/${id}`} className="inline-flex items-center gap-1 text-primary text-body-sm hover:underline">
            Open Forge overview <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
