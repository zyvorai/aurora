'use client';

import { useEffect, useState } from 'react';
import { FileText, ShieldAlert, Users } from 'lucide-react';
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
import { cn } from '@/lib/cn';
import { portalAdmin, type CustomerAccount, type ResellerAccount, type SalesPersonAccount } from '@/lib/portal-api';

type PortalAccount = CustomerAccount | ResellerAccount | SalesPersonAccount;
type PortalTab = 'customer' | 'reseller' | 'salesperson';

const TAB_LABEL: Record<PortalTab, string> = {
  customer: 'Customers',
  reseller: 'Resellers',
  salesperson: 'Sales reps',
};

function displayName(account: PortalAccount): string {
  if ('company_name' in account && account.company_name) return account.company_name;
  if ('contact_name' in account && account.contact_name) return account.contact_name;
  return '—';
}

const STATUS_VARIANT: Record<PortalAccount['status'], BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

export default function PortalAccountsAdminPage() {
  const { ready, role } = useAuth();
  const [tab, setTab] = useState<PortalTab>('customer');
  const [accounts, setAccounts] = useState<PortalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<PortalAccount | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'admin') {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tab]);

  function refresh() {
    setLoading(true);
    const call =
      tab === 'customer'
        ? portalAdmin.listAccounts()
        : tab === 'reseller'
          ? portalAdmin.listResellerAccounts()
          : portalAdmin.listSalesPersonAccounts();
    call
      .then((result) => setAccounts(result))
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load accounts'))
      .finally(() => setLoading(false));
  }

  async function handleApprove(account: PortalAccount) {
    setBusyId(account.id);
    try {
      if (tab === 'customer') await portalAdmin.approve(account.id);
      else if (tab === 'reseller') await portalAdmin.approveReseller(account.id);
      else await portalAdmin.approveSalesPerson(account.id);
      showToast('success', `Approved ${account.email}`);
      refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleViewDocument(account: PortalAccount) {
    try {
      const { url } =
        tab === 'reseller'
          ? await portalAdmin.getResellerDocumentUrl(account.id)
          : await portalAdmin.getSalesPersonDocumentUrl(account.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load document');
    }
  }

  async function handleReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setBusyId(rejectTarget.id);
    try {
      if (tab === 'customer') await portalAdmin.reject(rejectTarget.id, rejectReason.trim());
      else if (tab === 'reseller') await portalAdmin.rejectReseller(rejectTarget.id, rejectReason.trim());
      else await portalAdmin.rejectSalesPerson(rejectTarget.id, rejectReason.trim());
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
        description="Review and approve external portal signup requests."
      />

      <div className="flex gap-2">
        {(['customer', 'reseller', 'salesperson'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 rounded-full text-body-sm font-medium transition-colors focus-ring capitalize',
              tab === t ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground hover:bg-[var(--glass-bg)]',
            )}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={Users} title="No signup requests yet" description={`${TAB_LABEL[tab]} portal signups will appear here.`} />
      ) : (
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>{tab === 'salesperson' ? 'Name' : 'Company'}</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Requested</TableHeaderCell>
                {tab !== 'customer' && <TableHeaderCell>Document</TableHeaderCell>}
                <TableHeaderCell>{''}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>{displayName(account)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[account.status]}>{account.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(account.created_at).toLocaleDateString()}</TableCell>
                  {tab !== 'customer' && (
                    <TableCell>
                      {'proof_document_key' in account && account.proof_document_key ? (
                        <Button size="sm" variant="ghost" onClick={() => handleViewDocument(account)}>
                          <FileText className="w-4 h-4 mr-1.5" aria-hidden /> View
                        </Button>
                      ) : (
                        <span className="text-muted text-body-sm">—</span>
                      )}
                    </TableCell>
                  )}
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
