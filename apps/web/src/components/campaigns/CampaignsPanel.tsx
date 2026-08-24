'use client';

import { useCallback, useEffect, useState } from 'react';
import { campaigns as campaignsApi, type Campaign, type CampaignStatusReport } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { readStoredRole } from '@/lib/role-routing';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Megaphone } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow,
} from '@/components/ui/Table';
import { TextMuted, TextSmall } from '@/components/ui/Typography';

interface CampaignsPanelProps {
  productId: string;
}

export default function CampaignsPanel({ productId }: CampaignsPanelProps) {
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Campaign | null>(null);
  const [statusReport, setStatusReport] = useState<CampaignStatusReport | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const role = readStoredRole();
  const canWrite = role === 'admin' || role === 'editor';

  const load = useCallback(() => {
    setLoading(true);
    campaignsApi.list(productId)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load campaigns'))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await campaignsApi.create(productId, { name });
      showToast('success', 'Campaign created.');
      setCreateOpen(false);
      setName('');
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  }

  async function openStatus(campaign: Campaign) {
    setStatusTarget(campaign);
    setStatusReport(null);
    setStatusLoading(true);
    try {
      const report = await campaignsApi.status(productId, campaign.id);
      setStatusReport(report);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load campaign status');
    } finally {
      setStatusLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        label="Marketing"
        title="Campaigns"
        description="Track outbound campaigns and channel mix."
        action={canWrite ? <Button size="sm" onClick={() => setCreateOpen(true)}>+ New Campaign</Button> : undefined}
      />

      {loading ? (
        <TextMuted>Loading campaigns…</TextMuted>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create a campaign to plan outreach across channels and track engagement."
          actions={canWrite ? [{ label: '+ New Campaign', onClick: () => setCreateOpen(true) }] : undefined}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell><Badge variant="default">{c.campaign_type}</Badge></TableCell>
                <TableCell><Badge variant={c.status === 'active' ? 'success' : 'default'}>{c.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="secondary" onClick={() => openStatus(c)}>View status</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New campaign">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Q3 Enterprise Outbound"
            required
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!statusTarget} onClose={() => setStatusTarget(null)} title={`Status — ${statusTarget?.name ?? ''}`}>
        {statusLoading ? (
          <TextMuted>Loading…</TextMuted>
        ) : statusReport ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={statusReport.on_track ? 'success' : 'warning'}>
                {statusReport.on_track ? 'On track' : 'Needs attention'}
              </Badge>
              <TextSmall className="text-muted">{statusReport.status}</TextSmall>
            </div>
            {Object.entries(statusReport.progress).map(([key, p]) => (
              <ProgressBar
                key={key}
                percent={p.target > 0 ? (p.actual / p.target) * 100 : 0}
                label={`${key} (${p.actual}/${p.target})`}
              />
            ))}
            <Button size="sm" variant="secondary" onClick={() => statusTarget && openStatus(statusTarget)}>
              Refresh
            </Button>
          </div>
        ) : (
          <TextMuted>No status available.</TextMuted>
        )}
      </Modal>
    </section>
  );
}
