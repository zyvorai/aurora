'use client';

import { useEffect, useState } from 'react';
import { agents, type AgentRegistryEntry } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { PageHero } from '@/components/layout/PageHero';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow,
} from '@/components/ui/Table';
import { TextMuted, TextSmall } from '@/components/ui/Typography';

export default function AgentRegistryPage() {
  const [entries, setEntries] = useState<AgentRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agents.registry()
      .then(setEntries)
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load agent registry'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-content mx-auto px-6 py-8 space-y-6">
      <PageHero
        eyebrow="Platform"
        title="Agent Registry"
        description="Every agent in the platform, its compute tier, and implementation status."
      />

      {loading ? (
        <TextMuted>Loading agent registry…</TextMuted>
      ) : (
        <Card elevated>
          <CardBody className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Agent</TableHeaderCell>
                  <TableHeaderCell>Tier</TableHeaderCell>
                  <TableHeaderCell>Async</TableHeaderCell>
                  <TableHeaderCell>Model</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((a) => (
                  <TableRow key={a.agent_id}>
                    <TableCell>
                      <p className="font-medium">{a.display_name}</p>
                      <TextSmall className="text-muted">{a.description}</TextSmall>
                    </TableCell>
                    <TableCell><Badge variant="default">{a.compute_tier}</Badge></TableCell>
                    <TableCell>{a.async_required ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted">{a.model_key}</TableCell>
                    <TableCell>
                      <Badge variant={a.implemented ? 'success' : 'warning'}>
                        {a.implemented ? 'Implemented' : 'Not built'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
