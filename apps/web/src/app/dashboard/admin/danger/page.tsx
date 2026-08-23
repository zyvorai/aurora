'use client';

import { useEffect, useState } from 'react';
import { admin, type AdminPlanInfo } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/hooks/useAuth';
import { PageHero } from '@/components/layout/PageHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card, CardBody } from '@/components/ui/Card';
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
      admin.plan().then(setPlan).catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load plan info'));
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
      <div className="max-w-content mx-auto px-6 py-8 space-y-8">
        <SkeletonHero />
        <SkeletonText lines={3} />
      </div>
    );
  }

  // First client-side route guard in this app: this page is destructive enough
  // (irreversible data purge) that a non-admin should never see the form render
  // at all, rather than seeing it and only failing on submit with a 403.
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
    <div className="max-w-content mx-auto px-6 py-8 space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Admin"
        title="Danger Zone"
        description="Export or permanently delete this tenant's ingested data. These actions are logged to the audit trail."
      />

      <section>
        <SectionHeader label="Export" title="Download tenant data" />
        <Card elevated>
          <CardBody className="flex items-center justify-between">
            <TextMuted>
              Exports product metadata and user accounts as JSON. Does not include ingested
              documents, embeddings, or generated artifacts.
            </TextMuted>
            <Button variant="secondary" disabled={exporting} onClick={handleExport}>
              {exporting ? 'Exporting…' : 'Export data'}
            </Button>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeader label="Irreversible" title="Purge ingested data" />
        <Card elevated className="border-danger/40">
          <CardBody className="space-y-4">
            <TextMuted>
              Permanently deletes this tenant&apos;s ingested documents, embeddings, and
              knowledge-graph data from the vector store and knowledge graph. Products, users,
              and generated artifacts (proposals, content, etc.) are <strong>not</strong>{' '}
              affected — only source knowledge is wiped. This cannot be undone.
            </TextMuted>

            {purged ? (
              <TextSmall className="text-success">Tenant data has been purged.</TextSmall>
            ) : !plan ? (
              <TextMuted>Loading tenant info…</TextMuted>
            ) : (
              <div className="space-y-2">
                <TextSmall className="text-muted">
                  Type <span className="font-mono text-foreground">{plan.tenant_slug}</span> to confirm.
                </TextSmall>
                <div className="flex gap-2">
                  <Input
                    value={purgeConfirm}
                    onChange={(e) => setPurgeConfirm(e.target.value)}
                    placeholder={plan.tenant_slug}
                    className="flex-1 font-mono"
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
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
