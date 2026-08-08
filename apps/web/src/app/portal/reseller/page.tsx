'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, LogOut, Pencil, Plus, Sparkles } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { showToast } from '@/lib/toast';
import { resellerPortal, type ResellerAccount, type DealRegistration } from '@/lib/portal-api';
import { clearPortalSession, getPortalToken } from '@/lib/portal-auth';

const STATUS_VARIANT: Record<ResellerAccount['status'], BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

export default function ResellerHomePage() {
  const router = useRouter();
  const [account, setAccount] = useState<ResellerAccount | null>(null);
  const [deals, setDeals] = useState<DealRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [dealForm, setDealForm] = useState({ product_id: '', company_name: '', domain: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ company_name: '', contact_name: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getPortalToken()) {
      router.replace('/portal/reseller/login');
      return;
    }
    Promise.all([resellerPortal.me(), resellerPortal.myDeals().catch(() => [])])
      .then(([me, myDeals]) => {
        setAccount(me);
        setDeals(myDeals);
      })
      .catch(() => {
        clearPortalSession();
        router.replace('/portal/reseller/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleSignOut() {
    clearPortalSession();
    router.push('/portal/reseller/login');
  }

  function openEditModal() {
    if (!account) return;
    setEditForm({ company_name: account.company_name || '', contact_name: account.contact_name || '' });
    setShowEditModal(true);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await resellerPortal.updateMe(editForm);
      setAccount(updated);
      setShowEditModal(false);
      showToast('success', 'Profile updated');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleRegisterDeal(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const deal = await resellerPortal.registerDeal(dealForm);
      setDeals([deal, ...deals]);
      setShowModal(false);
      setDealForm({ product_id: '', company_name: '', domain: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register deal');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>;
  }

  if (!account) return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--glass-border)] bg-[var(--glass-bg-elevated)] backdrop-blur-[var(--blur-liquid)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="tahoe-icon-badge !w-8 !h-8 !rounded-md">
            <Sparkles className="w-4 h-4" aria-hidden />
          </div>
          <span className="font-semibold">Reseller Portal</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-1.5" aria-hidden /> Sign out
        </Button>
      </header>

      <main className="max-w-content mx-auto px-6 py-8 space-y-8">
        <PageHero
          icon={Building2}
          eyebrow="Account"
          title={account.company_name || account.contact_name || account.email}
          description={`Margin tier: ${account.margin_tier}`}
          actions={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={openEditModal}>
                <Pencil className="w-4 h-4 mr-1.5" aria-hidden /> Edit profile
              </Button>
              {account.status === 'approved' && (
                <Button onClick={() => setShowModal(true)}>
                  <Plus className="w-4 h-4 mr-1.5" aria-hidden /> Register Deal
                </Button>
              )}
            </div>
          }
        />

        <Card>
          <CardBody className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted text-body-sm">Status</span>
              <Badge variant={STATUS_VARIANT[account.status]}>{account.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted text-body-sm">Email</span>
              <span className="text-body-sm">{account.email}</span>
            </div>
            {account.business_id && (
              <div className="flex items-center justify-between">
                <span className="text-muted text-body-sm">Business ID</span>
                <span className="text-body-sm">{account.business_id}</span>
              </div>
            )}
          </CardBody>
        </Card>

        {account.status === 'approved' && (
          <section>
            <h2 className="text-lg font-semibold mb-3">My registered deals</h2>
            {deals.length === 0 ? (
              <EmptyState icon={Building2} title="No deals registered yet" description="Register a prospect to get started." />
            ) : (
              <Card>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Company</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Registered</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deals.map((deal) => (
                      <TableRow key={deal.id}>
                        <TableCell>{deal.company_name}</TableCell>
                        <TableCell>{deal.status}</TableCell>
                        <TableCell>{new Date(deal.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </section>
        )}
      </main>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Register a deal">
        <form onSubmit={handleRegisterDeal} className="space-y-4">
          <Input
            placeholder="Product ID"
            required
            value={dealForm.product_id}
            onChange={(e) => setDealForm({ ...dealForm, product_id: e.target.value })}
          />
          <Input
            placeholder="Prospect company name"
            required
            value={dealForm.company_name}
            onChange={(e) => setDealForm({ ...dealForm, company_name: e.target.value })}
          />
          <Input
            placeholder="Domain (optional)"
            value={dealForm.domain}
            onChange={(e) => setDealForm({ ...dealForm, domain: e.target.value })}
          />
          {error && <p className="text-danger text-body-sm">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Registering…' : 'Register'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit profile">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            placeholder="Company name"
            value={editForm.company_name}
            onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
          />
          <Input
            placeholder="Your name"
            value={editForm.contact_name}
            onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
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
