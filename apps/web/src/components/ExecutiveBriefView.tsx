'use client';

import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Stat, TextMuted, TextSmall } from '@/components/ui/Typography';

export interface ExecutiveBrief {
  product_id: string;
  product_name: string;
  profile_status: string;
  gtm_readiness: {
    ingest_started: boolean;
    ingest_complete: boolean;
    profile_built: boolean;
    strategy_ready: boolean;
    outreach_ready: boolean;
  };
  kpis: {
    leads: number;
    conversations: number;
    artifacts: number;
    agent_runs: number;
  };
  funnel: Record<string, number>;
  narrative: string;
  risks: string[];
  updated_at: string;
  compute_tier: string;
  narrative_llm?: string;
}

interface Props {
  brief: ExecutiveBrief;
}

function ReadinessBadge({ ok, readyLabel, pendingLabel }: { ok: boolean; readyLabel: string; pendingLabel: string }) {
  return (
    <Badge variant={ok ? 'success' : 'warning'}>{ok ? readyLabel : pendingLabel}</Badge>
  );
}

export default function ExecutiveBriefView({ brief }: Props) {
  const r = brief.gtm_readiness;

  return (
    <div className="space-y-6">
      {brief.narrative_llm && (
        <TextMuted className="italic border-l-2 border-primary pl-4">
          {brief.narrative_llm}
        </TextMuted>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Leads', value: brief.kpis.leads },
          { label: 'Conversations', value: brief.kpis.conversations },
          { label: 'Artifacts', value: brief.kpis.artifacts },
          { label: 'Agent runs', value: brief.kpis.agent_runs },
        ].map((kpi) => (
          <Card key={kpi.label} elevated>
            <CardBody className="py-4">
              <Stat label={kpi.label} value={kpi.value} />
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <SectionHeader label="Readiness" title="GTM status" />
          <div className="flex flex-wrap gap-2">
            <ReadinessBadge ok={r.ingest_complete} readyLabel="Ingest complete" pendingLabel="Ingest pending" />
            <ReadinessBadge ok={r.profile_built} readyLabel="Profile built" pendingLabel="Profile pending" />
            <ReadinessBadge ok={r.strategy_ready} readyLabel="Strategy ready" pendingLabel="Strategy pending" />
            <ReadinessBadge ok={r.outreach_ready} readyLabel="Outreach ready" pendingLabel="Outreach pending" />
          </div>
        </CardBody>
      </Card>

      {brief.risks.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardBody>
            <SectionHeader title="Attention" />
            <ul className="list-disc list-inside space-y-1">
              {brief.risks.map((risk) => (
                <li key={risk}><TextMuted>{risk}</TextMuted></li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <TextSmall>
        Updated {new Date(brief.updated_at).toLocaleString()} · {brief.compute_tier} (no LLM)
      </TextSmall>
    </div>
  );
}
