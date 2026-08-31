'use client';

import { useEffect, useState } from 'react';
import { admin, type AdminPlanInfo } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/hooks/useAuth';
import { PageHero } from '@/components/layout/PageHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShieldAlert } from 'lucide-react';
import { TextMuted, TextSmall } from '@/components/ui/Typography';
import { SkeletonHero, SkeletonText } from '@/components/ui/Skeleton';

export default function AdminDangerZonePage() {
  const { ready, role } = useAuth();
  const [plan, setPlan] = useState<AdminPlanInfo | null>(null);
  const [exporting, setExporting] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const [purging, setPurging] = useState(false);
  const [purged, setPurged] = useState(false);

  useEffect(() => {
    if (role === 'admin') {
      admin
        .plan()
        .then(setPlan)
        .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load plan info'));
    }
  }, [role]);

  async function handleExport() {
    setExporting(true);
    try {
      await admin.exportData();
      showToast('success', 'Export downloaded.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handlePurge() {
    if (!plan || purgeConfirm !== plan.tenant_slug) return;
    setPurging(true);
    try {
      await admin.purge(purgeConfirm);
      showToast('success', 'Tenant data purged.');
      setPurged(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Purge failed');
    } finally {
      setPurging(false);
    }
  }

  if (!ready) {
    return (
      <div className="max-w-content mx-auto px-[var(--hs-gutter)] py-10 space-y-8">
        <SkeletonHero />
        <SkeletonText lines={3} />
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="max-w-content mx-auto px-[var(--hs-gutter)] py-10">
        <EmptyState
          icon={ShieldAlert}
          title="Admin access required"
          description="This page is restricted to admin users."
        />
      </div>
    );
  }

  return (
    <div className="max-w-content mx-auto px-[var(--hs-gutter)] py-10 space-y-10 animate-fade-up">
      <PageHero
        eyebrow="Admin"
        title="Danger zone"
        description="Export or permanently delete this tenant's ingested data. These actions are logged to the audit trail."
      />

      <section>
        <SectionHeader title="Download tenant data" />
        <div className="rounded-[var(--radius-lg)] bg-background px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <p className="flex-1 text-[15px] text-muted leading-[1.47]">
            Exports product metadata and user accounts as JSON. Does not include ingested documents,
            embeddings, or generated artifacts.
          </p>
          <Button variant="secondary" disabled={exporting} onClick={handleExport} className="shrink-0">
            {exporting ? 'Exporting…' : 'Export data'}
          </Button>
        </div>
      </section>

      <section>
        <SectionHeader title="Purge ingested data" />
        <div className="rounded-[var(--radius-lg)] bg-background ring-1 ring-danger/30 px-5 py-5 space-y-4">
          <p className="text-[15px] text-muted leading-[1.47]">
            Permanently deletes this tenant&apos;s ingested documents, embeddings, and knowledge-graph
            data. Products, users, and generated artifacts are{' '}
            <strong className="text-foreground">not</strong> affected — only source knowledge is wiped.
            This cannot be undone.
          </p>

          {purged ? (
            <TextSmall className="text-success">Tenant data has been purged.</TextSmall>
          ) : !plan ? (
            <TextMuted>Loading tenant info…</TextMuted>
          ) : (
            <div className="space-y-2">
              <TextSmall className="text-muted">
                Type <span className="text-foreground">{plan.tenant_slug}</span> to confirm.
              </TextSmall>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={purgeConfirm}
                  onChange={(e) => setPurgeConfirm(e.target.value)}
                  placeholder={plan.tenant_slug}
                  className="flex-1"
                />
                <Button
                  variant="danger"
                  disabled={purging || purgeConfirm !== plan.tenant_slug}
                  onClick={handlePurge}
                >
                  {purging ? 'Purging…' : 'Purge data'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
