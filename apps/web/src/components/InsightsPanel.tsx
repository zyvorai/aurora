'use client';

import type { ProductInsights } from '@/lib/api';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Stat, TextMuted, TextSmall } from '@/components/ui/Typography';

interface Props {
  insights: ProductInsights;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function InsightsPanel({ insights, onRefresh, refreshing }: Props) {
  const pipeline = insights.pipeline ?? { by_stage: {}, total_opportunities: 0, weighted_value: 0 };
  const campaigns = insights.campaigns ?? { total: 0, active: 0 };

  return (
    <Card elevated>
      <CardBody className="space-y-4">
        <SectionHeader
          label="Intelligence"
          title={`Analytics · ${insights.compute_tier}`}
          action={
            onRefresh ? (
              <Button variant="secondary" size="sm" disabled={refreshing} onClick={onRefresh}>
                {refreshing ? 'Refreshing…' : 'Refresh weekly narrative'}
              </Button>
            ) : undefined
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Opportunities', value: pipeline.total_opportunities },
            { label: 'Weighted pipeline', value: `$${pipeline.weighted_value.toLocaleString()}` },
            { label: 'Campaigns', value: campaigns.total },
            { label: 'Active campaigns', value: campaigns.active },
          ].map((item) => (
            <Stat key={item.label} label={item.label} value={item.value} />
          ))}
        </div>

        {insights.narrative_llm ? (
          <TextMuted className="italic border-t border-border pt-3">
            {insights.narrative_llm}
            {insights.narrative_updated_at && (
              <TextSmall className="block mt-1 not-italic opacity-70">
                Weekly insight · {new Date(insights.narrative_updated_at).toLocaleDateString()}
                {insights.narrative_fresh ? ' · fresh' : ' · stale'}
              </TextSmall>
            )}
          </TextMuted>
        ) : (
          <TextSmall>
            No weekly narrative yet. Refresh runs LLM at most once per week.
          </TextSmall>
        )}
      </CardBody>
    </Card>
  );
}
