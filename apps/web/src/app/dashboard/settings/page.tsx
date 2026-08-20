'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { admin, auth, type AdminPlanInfo, type SuppressionEntry } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { readStoredRole } from '@/lib/role-routing';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { PageHero } from '@/components/layout/PageHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text, TextMuted, TextSmall } from '@/components/ui/Typography';

interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string;
}

export default function SettingsPage() {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [plan, setPlan] = useState<AdminPlanInfo | null>(null);
  const [suppressions, setSuppressions] = useState<SuppressionEntry[]>([]);
  const [suppressEmail, setSuppressEmail] = useState('');
  const [addingSuppression, setAddingSuppression] = useState(false);
  const isAdmin = readStoredRole() === 'admin';

  useEffect(() => {
    auth.me()
      .then(setUser)
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load account'));
  }, []);

  useEffect(() => {
    admin.plan().then(setPlan).catch(() => {});
    admin.listSuppressions().then(setSuppressions).catch(() => {});
  }, []);

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
    <div className="max-w-content mx-auto px-6 py-8 space-y-8">
      <PageHero eyebrow="Account" title="Settings" description="Manage your account and workspace preferences." />

      <section>
        <SectionHeader label="Account" title="Your profile" />
        <Card elevated>
          <CardBody className="space-y-3">
            {user ? (
              <>
                <div className="flex items-center justify-between">
                  <TextMuted>Name</TextMuted>
                  <Text>{user.full_name || '—'}</Text>
                </div>
                <div className="flex items-center justify-between">
                  <TextMuted>Email</TextMuted>
                  <Text>{user.email}</Text>
                </div>
                <div className="flex items-center justify-between">
                  <TextMuted>Role</TextMuted>
                  <Badge variant="default" className="capitalize">{user.role}</Badge>
                </div>
              </>
            ) : (
              <TextMuted>Loading…</TextMuted>
            )}
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeader label="Preferences" title="Appearance" />
        <Card elevated>
          <CardBody className="flex items-center justify-between">
            <div>
              <Text>Theme</Text>
              <TextSmall className="text-muted">Switch between dark and light mode.</TextSmall>
            </div>
            <Button variant="secondary" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            </Button>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeader label="Account" title="Plan usage" />
        <Card elevated>
          <CardBody className="space-y-3">
            {plan ? (
              <>
                <div className="flex items-center justify-between">
                  <TextMuted>Plan</TextMuted>
                  <Badge variant="default" className="capitalize">{plan.plan}</Badge>
                </div>
                <ProgressBar
                  percent={plan.features.products > 0 ? (plan.usage.products_used / plan.features.products) * 100 : 0}
                  label={`Products (${plan.usage.products_used}/${plan.features.products})`}
                />
              </>
            ) : (
              <TextMuted>Loading…</TextMuted>
            )}
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeader label="Compliance" title="Suppression list" description="Emails opted out of outreach — checked before every send." />
        <Card elevated>
          <CardBody className="space-y-4">
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
          </CardBody>
        </Card>
      </section>

      {isAdmin && (
        <section>
          <SectionHeader label="Portals" title="Customer portal accounts" />
          <Card elevated>
            <CardBody className="flex items-center justify-between">
              <TextMuted>Review and approve customer portal signup requests.</TextMuted>
              <Link href="/dashboard/admin/portal-accounts">
                <Button variant="secondary">Review requests</Button>
              </Link>
            </CardBody>
          </Card>
        </section>
      )}

      {isAdmin && (
        <section>
          <SectionHeader label="Danger zone" title="Data export & purge" />
          <Card elevated className="border-danger/30">
            <CardBody className="flex items-center justify-between">
              <TextMuted>Export or permanently delete this tenant&apos;s ingested data.</TextMuted>
              <Link href="/dashboard/admin/danger">
                <Button variant="danger">Open danger zone</Button>
              </Link>
            </CardBody>
          </Card>
        </section>
      )}

      <section>
        <SectionHeader label="Platform" title="Agent registry" />
        <Card elevated>
          <CardBody className="flex items-center justify-between">
            <TextMuted>Browse every agent, its compute tier, and implementation status.</TextMuted>
            <Link href="/dashboard/agents">
              <Button variant="secondary">View agent registry</Button>
            </Link>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeader label="Compliance" title="Audit log" />
        <Card elevated>
          <CardBody className="flex items-center justify-between">
            <TextMuted>Review write, approve, and publish actions across your tenant.</TextMuted>
            <Link href="/dashboard/audit">
              <Button variant="secondary">View audit log</Button>
            </Link>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeader label="Session" title="Sign out" />
        <Card elevated>
          <CardBody className="flex items-center justify-between">
            <TextMuted>End your session on this device.</TextMuted>
            <Button variant="danger" onClick={signOut}>Sign out</Button>
          </CardBody>
        </Card>
      </section>

      <TextSmall className="text-muted">
        User and role management isn&apos;t available in this UI yet — roles are assigned when a
        tenant is created and updated directly in the database. Contact your admin to change a
        teammate&apos;s role.
      </TextSmall>
    </div>
  );
}
