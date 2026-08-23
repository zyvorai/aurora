'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { products, type ExecutiveBrief, type ProductInsights } from '@/lib/api';
import { useProduct } from '@/context/ProductContext';
import { PageHero } from '@/components/layout/PageHero';
import ExecutiveBriefView from '@/components/ExecutiveBriefView';
import InsightsPanel from '@/components/InsightsPanel';
import { Button } from '@/components/ui/Button';
import { TextSmall } from '@/components/ui/Typography';
import { WORKSPACE_ICONS, WORKSPACE_COLORS } from '@/lib/nav-data';
import { SkeletonText } from '@/components/ui/Skeleton';

export default function BriefPage() {
  const { id } = useParams<{ id: string }>();
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

  return (
    <div className="space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Executive Brief"
        title={product?.name ?? 'Product'}
        description={brief?.narrative ?? 'Tier 0 dashboard — SQL aggregates, no LLM at read time.'}
        icon={WORKSPACE_ICONS.brief}
        accent={WORKSPACE_COLORS.brief}
      />
      {error && <TextSmall className="text-danger">{error}</TextSmall>}
      {!brief && !error && <SkeletonText lines={5} />}
      {brief && <ExecutiveBriefView brief={brief} />}
      {insights && (
        <InsightsPanel
          insights={insights}
          onRefresh={handleRefreshInsights}
          refreshing={refreshing}
        />
      )}
      {!insights && (
        <Button variant="secondary" onClick={handleRefreshInsights} disabled={refreshing}>
          Load intelligence
        </Button>
      )}
    </div>
  );
}
