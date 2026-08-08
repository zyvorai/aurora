'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { showToast } from '@/lib/toast';
import { PageHero } from '@/components/layout/PageHero';
import { Card } from '@/components/ui/Card';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { portalAdmin, type CustomerAccount } from '@/lib/portal-api';

const STATUS_VARIANT: Record<CustomerAccount['status'], BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

export default function PortalAccountsAdminPage() {
  const { ready, role } = useAuth();
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<CustomerAccount | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'admin') {
      refresh();
    }
  }, [role]);

  function refresh() {
    setLoading(true);
    portalAdmin
      .listAccounts()
      .then(setAccounts)
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load accounts'))
      .finally(() => setLoading(false));
  }

  async function handleApprove(account: CustomerAccount) {
    setBusyId(account.id);
    try {
      await portalAdmin.approve(account.id);
      showToast('success', `Approved ${account.email}`);
      refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setBusyId(rejectTarget.id);
    try {
      await portalAdmin.reject(rejectTarget.id, rejectReason.trim());
      showToast('success', `Rejected ${rejectTarget.email}`);
      setRejectTarget(null);
      setRejectReason('');
      refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) {
    return <div className="max-w-content mx-auto px-6 py-8 text-muted">Loading…</div>;
  }

  // Same pattern as the danger-zone page: a non-admin should never see the approval
  // queue render at all, not just fail on submit.
  if (role !== 'admin') {
    return (
      <div className="max-w-content mx-auto px-6 py-8">
        <EmptyState
          icon={ShieldAlert}
          title="Admin access required"
          description="This page is restricted to admin users."
        />
      </div>
    );
  }

  return (
    <div className="max-w-content mx-auto px-6 py-8 space-y-8">
      <PageHero
        icon={Users}
        eyebrow="Admin"
        title="Portal Accounts"
        description="Review and approve customer portal signup requests."
      />

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={Users} title="No signup requests yet" description="Customer portal signups will appear here." />
      ) : (
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Company</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Requested</TableHeaderCell>
                <TableHeaderCell>{''}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>{account.company_name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[account.status]}>{account.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(account.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {account.status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          disabled={busyId === account.id}
                          onClick={() => handleApprove(account)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === account.id}
                          onClick={() => setRejectTarget(account)}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Modal
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title={`Reject ${rejectTarget?.email ?? ''}`}
      >
        <div className="space-y-4">
          <Input
            placeholder="Reason for rejection"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!rejectReason.trim() || busyId === rejectTarget?.id}
              onClick={handleReject}
            >
              Reject account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
