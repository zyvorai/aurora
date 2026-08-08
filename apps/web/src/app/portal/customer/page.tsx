'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, LogOut, Pencil, Sparkles } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { showToast } from '@/lib/toast';
import { portal, type CustomerAccount } from '@/lib/portal-api';
import { clearPortalSession, getPortalToken } from '@/lib/portal-auth';

const STATUS_VARIANT: Record<CustomerAccount['status'], BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

export default function CustomerHomePage() {
  const router = useRouter();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ company_name: '', contact_name: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getPortalToken()) {
      router.replace('/portal/customer/login');
      return;
    }
    portal
      .me()
      .then(setAccount)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Session expired');
        clearPortalSession();
        router.replace('/portal/customer/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleSignOut() {
    clearPortalSession();
    router.push('/portal/customer/login');
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
      const updated = await portal.updateMe(editForm);
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
    return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>;
  }

  if (error || !account) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--glass-border)] bg-[var(--glass-bg-elevated)] backdrop-blur-[var(--blur-liquid)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="tahoe-icon-badge !w-8 !h-8 !rounded-md">
            <Sparkles className="w-4 h-4" aria-hidden />
          </div>
          <span className="font-semibold">Customer Portal</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-1.5" aria-hidden /> Sign out
        </Button>
      </header>

      <main className="max-w-content mx-auto px-6 py-8">
        <PageHero
          icon={Building2}
          eyebrow="Account"
          title={account.company_name || account.contact_name || account.email}
          description="Your account status and details."
          actions={
            <Button variant="secondary" size="sm" onClick={openEditModal}>
              <Pencil className="w-4 h-4 mr-1.5" aria-hidden /> Edit profile
            </Button>
          }
        />

        <Card className="mt-6">
          <CardBody className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted text-body-sm">Status</span>
              <Badge variant={STATUS_VARIANT[account.status]}>{account.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted text-body-sm">Email</span>
              <span className="text-body-sm">{account.email}</span>
            </div>
            {account.contact_name && (
              <div className="flex items-center justify-between">
                <span className="text-muted text-body-sm">Contact</span>
                <span className="text-body-sm">{account.contact_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted text-body-sm">Member since</span>
              <span className="text-body-sm">{new Date(account.created_at).toLocaleDateString()}</span>
            </div>
          </CardBody>
        </Card>
      </main>

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
