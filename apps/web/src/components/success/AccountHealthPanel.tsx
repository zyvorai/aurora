'use client';

import { useCallback, useEffect, useState } from 'react';
import { products, type AccountHealthRecord } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { readStoredRole } from '@/lib/role-routing';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeartPulse } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow,
} from '@/components/ui/Table';
import { TextMuted } from '@/components/ui/Typography';

function statusVariant(status: string): BadgeVariant {
  if (status === 'healthy') return 'success';
  if (status === 'at_risk') return 'warning';
  return 'danger';
}

interface AccountHealthPanelProps {
  productId: string;
}

export default function AccountHealthPanel({ productId }: AccountHealthPanelProps) {
  const [records, setRecords] = useState<AccountHealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const role = readStoredRole();
  const canWrite = role === 'admin' || role === 'editor';

  const load = useCallback(() => {
    setLoading(true);
    products.accountHealth(productId)
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load account health'))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await products.refreshCsBriefs(productId);
      showToast('success', 'Customer success briefs refreshed.');
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        label="Post-sale"
        title="Customer Success"
        description="Account health across closed and active opportunities."
        action={canWrite ? (
          <Button size="sm" variant="secondary" disabled={refreshing} onClick={handleRefresh}>
            {refreshing ? 'Refreshing…' : 'Refresh CS Briefs'}
          </Button>
        ) : undefined}
      />

      {loading ? (
        <TextMuted>Loading account health…</TextMuted>
      ) : records.length === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title="No account health data yet"
          description="Health scores appear once opportunities close and customer success briefs are generated."
          actions={canWrite ? [{ label: 'Refresh CS Briefs', onClick: handleRefresh }] : undefined}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Opportunity</TableHeaderCell>
              <TableHeaderCell>Health score</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Last brief</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.opportunity_id.slice(0, 8)}</TableCell>
                <TableCell className="tabular-nums">{r.health_score.toFixed(0)}</TableCell>
                <TableCell><Badge variant={statusVariant(r.status)}>{r.status}</Badge></TableCell>
                <TableCell className="text-muted">
                  {r.last_cs_brief_at ? new Date(r.last_cs_brief_at).toLocaleDateString() : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
