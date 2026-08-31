'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Pencil, TrendingUp } from 'lucide-react';
import { GlobalNav } from '@/components/layout/GlobalNav/GlobalNav';
import { PageHero } from '@/components/layout/PageHero';
import { KpiStrip, WorkspacePage, WorkspacePanel } from '@/components/layout/WorkspacePanel';
import { SkeletonLine } from '@/components/ui/Skeleton';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { showToast } from '@/lib/toast';
import { salesPersonPortal, type SalesPersonAccount, type SalesPersonPipeline } from '@/lib/portal-api';
import { clearPortalSession, getPortalToken } from '@/lib/portal-auth';
import { PortalStatusNotice } from '@/components/portal/PortalStatusNotice';

const STATUS_VARIANT: Record<SalesPersonAccount['status'], BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

export default function SalesPersonHomePage() {
  const router = useRouter();
  const [account, setAccount] = useState<SalesPersonAccount | null>(null);
  const [pipeline, setPipeline] = useState<SalesPersonPipeline>({ leads: [], opportunities: [] });
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ contact_name: '', territory: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getPortalToken()) {
      router.replace('/portal/salesperson/login');
      return;
    }
    Promise.all([
      salesPersonPortal.me(),
      salesPersonPortal.myPipeline().catch(() => ({ leads: [], opportunities: [] })),
    ])
      .then(([me, myPipeline]) => {
        setAccount(me);
        setPipeline({
          leads: Array.isArray(myPipeline?.leads) ? myPipeline.leads : [],
          opportunities: Array.isArray(myPipeline?.opportunities) ? myPipeline.opportunities : [],
        });
      })
      .catch(() => {
        clearPortalSession();
        router.replace('/portal/salesperson/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleSignOut() {
    clearPortalSession();
    router.push('/portal/salesperson/login');
  }

  function openEditModal() {
    if (!account) return;
    setEditForm({ contact_name: account.contact_name || '', territory: account.territory || '' });
    setShowEditModal(true);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await salesPersonPortal.updateMe(editForm);
      setAccount(updated);
      setShowEditModal(false);
      showToast('success', 'Profile updated');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SkeletonLine className="w-40 h-4" />
      </div>
    );
  }

  if (!account) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <GlobalNav variant="portal" portalLabel="Sales Rep Portal" onSignOut={handleSignOut} />

      <main className="flex-1 max-w-content mx-auto px-[var(--hs-gutter)] py-10 w-full">
        <WorkspacePage>
          <PageHero
            eyebrow="Account"
            title={account.contact_name || account.email}
            description={account.territory ? `Territory: ${account.territory}` : 'My assigned pipeline'}
            actions={
              <Button variant="secondary" size="sm" onClick={openEditModal}>
                <Pencil className="w-4 h-4 mr-1.5" aria-hidden /> Edit profile
              </Button>
            }
          />

          <KpiStrip
            items={[
              { label: 'Status', value: account.status },
              { label: 'Leads', value: pipeline.leads.length },
              { label: 'Opportunities', value: pipeline.opportunities.length },
              { label: 'Commission', value: `${(account.commission_rate * 100).toFixed(1)}%` },
            ]}
          />

          <WorkspacePanel title="Account details" bodyClassName="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-muted text-[13px]">Status</span>
              <Badge variant={STATUS_VARIANT[account.status]}>{account.status}</Badge>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-muted text-[13px]">Email</span>
              <span className="text-[13px]">{account.email}</span>
            </div>
            {account.territory && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-muted text-[13px]">Territory</span>
                <span className="text-[13px]">{account.territory}</span>
              </div>
            )}
          </WorkspacePanel>

          <PortalStatusNotice status={account.status} signupHref="/portal/salesperson/signup" />

          {account.status === 'approved' && (
            <>
              <WorkspacePanel title="Assigned leads" description={`${pipeline.leads.length} lead${pipeline.leads.length === 1 ? '' : 's'}`}>
                {pipeline.leads.length === 0 ? (
                  <div className="p-4">
                    <EmptyState icon={TrendingUp} tone="teal" title="No leads assigned yet" description="Leads assigned to you will appear here." />
                  </div>
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Company</TableHeaderCell>
                        <TableHeaderCell>Contact</TableHeaderCell>
                        <TableHeaderCell>Stage</TableHeaderCell>
                        <TableHeaderCell>Score</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pipeline.leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>{lead.company || '—'}</TableCell>
                          <TableCell>{lead.name || lead.email || '—'}</TableCell>
                          <TableCell>{lead.stage}</TableCell>
                          <TableCell>{lead.score.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </WorkspacePanel>

              <WorkspacePanel title="Assigned opportunities" description={`${pipeline.opportunities.length} open`}>
                {pipeline.opportunities.length === 0 ? (
                  <div className="p-4">
                    <EmptyState icon={Briefcase} tone="teal" title="No opportunities assigned yet" description="Opportunities assigned to you will appear here." />
                  </div>
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Name</TableHeaderCell>
                        <TableHeaderCell>Company</TableHeaderCell>
                        <TableHeaderCell>Stage</TableHeaderCell>
                        <TableHeaderCell>Amount</TableHeaderCell>
                        <TableHeaderCell>Probability</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pipeline.opportunities.map((opp) => (
                        <TableRow key={opp.id}>
                          <TableCell>{opp.name}</TableCell>
                          <TableCell>{opp.company || '—'}</TableCell>
                          <TableCell>{opp.stage}</TableCell>
                          <TableCell>{opp.amount != null ? `$${opp.amount.toLocaleString()}` : '—'}</TableCell>
                          <TableCell>{Math.round(opp.probability * 100)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </WorkspacePanel>
            </>
          )}
        </WorkspacePage>
      </main>

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit profile">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            placeholder="Your name"
            value={editForm.contact_name}
            onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
          />
          <Input
            placeholder="Territory"
            value={editForm.territory}
            onChange={(e) => setEditForm({ ...editForm, territory: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
