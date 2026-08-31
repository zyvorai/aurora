'use client';

import { useState } from 'react';
import { artifacts as artifactsApi, PUBLISH_CHANNELS, type Artifact, type PublishChannel } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileText } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow,
} from '@/components/ui/Table';
import { TextSmall } from '@/components/ui/Typography';

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'approved' || status === 'published') return 'success';
  if (status === 'rejected' || status === 'blocked' || status === 'failed') return 'danger';
  if (status === 'draft' || status === 'not_configured' || status === 'pending') return 'warning';
  return 'default';
}

const EMAIL_CHANNELS = new Set<PublishChannel>(['email', 'newsletter']);

interface ArtifactListProps {
  artifacts: Artifact[];
  canApprove: boolean;
  canPublish: boolean;
  onChanged?: () => void;
}

export default function ArtifactList({ artifacts, canApprove, canPublish, onChanged }: ArtifactListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<Artifact | null>(null);
  const [channel, setChannel] = useState<PublishChannel>('email');
  const [recipient, setRecipient] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  async function handleApprove(artifact: Artifact, status: 'approved' | 'rejected') {
    setBusyId(artifact.id);
    try {
      await artifactsApi.approve(artifact.id, { status });
      showToast('success', `Artifact ${status}.`);
      onChanged?.();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setBusyId(null);
    }
  }

  function openPublish(artifact: Artifact) {
    setPublishTarget(artifact);
    setChannel('email');
    setRecipient('');
    setScheduledAt('');
  }

  async function handlePublish() {
    if (!publishTarget) return;
    setBusyId(publishTarget.id);
    try {
      const res = await artifactsApi.publish(publishTarget.id, {
        channel,
        scheduled_at: scheduledAt || undefined,
        recipient: EMAIL_CHANNELS.has(channel) && recipient ? recipient : undefined,
      });
      if (res.status === 'blocked') {
        showToast('warning', 'Publish blocked — recipient is on the suppression list.');
      } else if (res.status === 'not_configured') {
        showToast('warning', `${channel} is not configured yet — no message was sent.`);
      } else {
        showToast('success', `Publish ${res.status}.`);
      }
      setPublishTarget(null);
      onChanged?.();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusyId(null);
    }
  }

  if (artifacts.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No artifacts yet"
        description="Generate content, strategy, or a proposal from the other tabs to see it here."
      />
    );
  }

  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Title</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell className="text-right">Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {artifacts.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium max-w-xs truncate">{a.title}</TableCell>
              <TableCell><Badge variant="default">{a.type}</Badge></TableCell>
              <TableCell><Badge variant={statusVariant(a.status)}>{a.status}</Badge></TableCell>
              <TableCell className="text-right space-x-2">
                {canApprove && a.status === 'draft' && (
                  <>
                    <Button size="sm" variant="secondary" disabled={busyId === a.id} onClick={() => handleApprove(a, 'approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => handleApprove(a, 'rejected')}>
                      Reject
                    </Button>
                  </>
                )}
                {canPublish && (
                  <Button size="sm" variant="secondary" disabled={busyId === a.id} onClick={() => openPublish(a)}>
                    Publish
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal open={!!publishTarget} onClose={() => setPublishTarget(null)} title={`Publish "${publishTarget?.title ?? ''}"`}>
        <div className="space-y-4">
          <div>
            <TextSmall className="mb-1 block text-muted">Channel</TextSmall>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as PublishChannel)}
              className="apple-select"
            >
              {PUBLISH_CHANNELS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {EMAIL_CHANNELS.has(channel) && (
            <div>
              <TextSmall className="mb-1 block text-muted">Recipient email</TextSmall>
              <Input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="prospect@example.com (defaults to broadcast address)"
              />
            </div>
          )}

          <div>
            <TextSmall className="mb-1 block text-muted">Schedule for later (optional)</TextSmall>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPublishTarget(null)}>Cancel</Button>
            <Button disabled={busyId === publishTarget?.id} onClick={handlePublish}>
              {scheduledAt ? 'Schedule' : 'Publish now'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
