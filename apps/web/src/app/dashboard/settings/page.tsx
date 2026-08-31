'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { admin, auth, products, type AdminPlanInfo, type CrmSyncStatus, type Product, type SuppressionEntry } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { readStoredRole } from '@/lib/role-routing';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { PageHero } from '@/components/layout/PageHero';
import { WorkspacePage } from '@/components/layout/WorkspacePanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Eyebrow, Text, TextMuted, TextSmall } from '@/components/ui/Typography';
import { SkeletonText } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';

interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string;
}

function SettingsGroup({ label, danger, children }: { label: string; danger?: boolean; children: ReactNode }) {
  return (
    <section>
      <Eyebrow className="mb-2 px-1">{label}</Eyebrow>
      <div
        className={cn(
          'apple-card divide-y divide-border overflow-hidden',
          danger && 'ring-1 ring-danger/30',
        )}
      >
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  title,
  description,
  value,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  value?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <Text>{title}</Text>
        {description && <TextSmall className="mt-0.5 block text-muted">{description}</TextSmall>}
      </div>
      {(value || action) && <div className="shrink-0">{value ?? action}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [plan, setPlan] = useState<AdminPlanInfo | null>(null);
  const [suppressions, setSuppressions] = useState<SuppressionEntry[]>([]);
  const [suppressEmail, setSuppressEmail] = useState('');
  const [addingSuppression, setAddingSuppression] = useState(false);
  const [crmStatus, setCrmStatus] = useState<CrmSyncStatus | null>(null);
  const [productList, setProductList] = useState<Product[]>([]);
  const [syncProductId, setSyncProductId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const isAdmin = readStoredRole() === 'admin';

  useEffect(() => {
    auth.me()
      .then(setUser)
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load account'));
  }, []);

  useEffect(() => {
    admin.plan().then(setPlan).catch(() => {});
    admin.listSuppressions().then(setSuppressions).catch(() => {});
    products.crmSyncStatus().then(setCrmStatus).catch(() => {});
    products.list().then((list) => {
      setProductList(list);
      if (list.length > 0) setSyncProductId(list[0].id);
    }).catch(() => {});
  }, []);

  async function handleCrmSync() {
    if (!syncProductId) return;
    setSyncing(true);
    try {
      const res = await products.triggerCrmSync(syncProductId);
      showToast('success', `CRM sync complete${res.synced != null ? ` (${String(res.synced)} records)` : ''}.`);
      products.crmSyncStatus().then(setCrmStatus).catch(() => {});
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'CRM sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleAddSuppression(e: React.FormEvent) {
    e.preventDefault();
    if (!suppressEmail.trim()) return;
    setAddingSuppression(true);
    try {
      await admin.addSuppression(suppressEmail.trim());
      showToast('success', `${suppressEmail} added to suppression list.`);
      setSuppressEmail('');
      admin.listSuppressions().then(setSuppressions).catch(() => {});
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to add suppression entry');
    } finally {
      setAddingSuppression(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-[var(--hs-gutter)] py-10 space-y-8 animate-fade-up min-h-full bg-[var(--app-canvas)]">
      <WorkspacePage>
      <PageHero eyebrow="Account" title="Settings" description="Manage your account and workspace preferences." variant="display" />

      <SettingsGroup label="Account">
        {user ? (
          <>
            <SettingsRow title="Name" value={<TextMuted>{user.full_name || '—'}</TextMuted>} />
            <SettingsRow title="Email" value={<TextMuted>{user.email}</TextMuted>} />
            <SettingsRow title="Role" value={<Badge variant="default" className="capitalize">{user.role}</Badge>} />
          </>
        ) : (
          <div className="px-5 py-4"><SkeletonText lines={2} /></div>
        )}
      </SettingsGroup>

      <SettingsGroup label="Preferences">
        <SettingsRow
          title="Appearance"
          description="Switch between dark and light mode."
          action={
            <Button variant="secondary" size="sm" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            </Button>
          }
        />
      </SettingsGroup>

      <SettingsGroup label="Plan">
        {plan?.features && plan?.usage ? (
          <>
            <SettingsRow title="Plan" value={<Badge variant="default" className="capitalize">{plan.plan}</Badge>} />
            <div className="px-5 py-4">
              <ProgressBar
                percent={plan.features.products > 0 ? (plan.usage.products_used / plan.features.products) * 100 : 0}
                label={`Products (${plan.usage.products_used}/${plan.features.products})`}
              />
            </div>
          </>
        ) : (
          <div className="px-5 py-4"><SkeletonText lines={2} /></div>
        )}
      </SettingsGroup>

      <SettingsGroup label="GTM integrations">
        {crmStatus ? (
          <>
            <SettingsRow
              title="Enrichment"
              description="Waterfall: Apollo → static heuristics on discover."
              value={<Badge variant={crmStatus.enrichment_enabled ? 'success' : 'default'}>
                {crmStatus.apollo_configured ? 'Apollo + static' : 'Static only'}
              </Badge>}
            />
            <SettingsRow
              title="CRM sync"
              description="Push qualified leads and opportunities to an external CRM."
              value={<Badge variant={crmStatus.enabled ? 'success' : 'warning'}>
                {crmStatus.enabled ? (crmStatus.provider || 'enabled') : 'Disabled'}
              </Badge>}
            />
            {crmStatus.enabled && productList.length > 0 ? (
              <div className="px-5 py-4 flex flex-col sm:flex-row gap-2 sm:items-center border-t border-border">
                <select
                  value={syncProductId}
                  onChange={(e) => setSyncProductId(e.target.value)}
                  className="apple-select flex-1"
                >
                  {productList.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Button size="sm" onClick={handleCrmSync} disabled={syncing || !isAdmin}>
                  {syncing ? 'Syncing…' : 'Sync now'}
                </Button>
              </div>
            ) : null}
            <SettingsRow
              title="Providers"
              description="Configure via server env: SALES_CRM_URL, HUBSPOT_ACCESS_TOKEN, APOLLO_API_KEY."
              value={
                <TextSmall className="text-muted">
                  {[
                    crmStatus.sales_crm_configured && 'sales-crm',
                    crmStatus.hubspot_configured && 'HubSpot',
                  ].filter(Boolean).join(' · ') || 'None configured'}
                </TextSmall>
              }
            />
          </>
        ) : (
          <div className="px-5 py-4"><SkeletonText lines={2} /></div>
        )}
      </SettingsGroup>

      <SettingsGroup label="Compliance">
        <div className="px-5 py-4 space-y-3">
          <div>
            <Text>Suppression list</Text>
            <TextSmall className="text-muted">Emails opted out of outreach — checked before every send.</TextSmall>
          </div>
          {isAdmin || readStoredRole() === 'editor' ? (
            <form onSubmit={handleAddSuppression} className="flex gap-2">
              <Input
                type="email"
                value={suppressEmail}
                onChange={(e) => setSuppressEmail(e.target.value)}
                placeholder="prospect@example.com"
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={addingSuppression}>
                {addingSuppression ? 'Adding…' : 'Add'}
              </Button>
            </form>
          ) : null}
          {suppressions.length === 0 ? (
            <TextMuted>No suppressed addresses.</TextMuted>
          ) : (
            <ul className="space-y-1">
              {suppressions.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-body-sm">
                  <span>{s.email}</span>
                  <TextSmall className="text-muted">{s.reason}</TextSmall>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingsGroup>

      {isAdmin && (
        <SettingsGroup label="Manage">
          <SettingsRow
            title="Customer portal accounts"
            description="Review and approve customer portal signup requests."
            action={<Link href="/dashboard/admin/portal-accounts"><Button variant="secondary" size="sm">Review</Button></Link>}
          />
          <SettingsRow
            title="Workflow stages"
            description="Tenant-defined stages on every product's Workspace sidebar."
            action={<Link href="/dashboard/admin/workflow-stages"><Button variant="secondary" size="sm">Manage</Button></Link>}
          />
          <SettingsRow
            title="Agent registry"
            description="Every agent, its compute tier, and implementation status."
            action={<Link href="/dashboard/agents"><Button variant="secondary" size="sm">View</Button></Link>}
          />
          <SettingsRow
            title="Audit log"
            description="Write, approve, and publish actions across your tenant."
            action={<Link href="/dashboard/audit"><Button variant="secondary" size="sm">View</Button></Link>}
          />
        </SettingsGroup>
      )}

      {isAdmin && (
        <SettingsGroup label="Danger zone" danger>
          <SettingsRow
            title="Data export & purge"
            description="Export or permanently delete this tenant's ingested data."
            action={<Link href="/dashboard/admin/danger"><Button variant="danger" size="sm">Open</Button></Link>}
          />
        </SettingsGroup>
      )}

      <SettingsGroup label="Session">
        <SettingsRow title="Sign out" description="End your session on this device." action={<Button variant="danger" size="sm" onClick={signOut}>Sign out</Button>} />
      </SettingsGroup>

      <TextSmall className="block px-1 text-muted">
        User and role management isn&apos;t available in this UI yet — roles are assigned when a
        tenant is created and updated directly in the database. Contact your admin to change a
        teammate&apos;s role.
      </TextSmall>
      </WorkspacePage>
    </div>
  );
}
