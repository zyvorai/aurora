'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { auth } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { PageHero } from '@/components/layout/PageHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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

  useEffect(() => {
    auth.me()
      .then(setUser)
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load account'));
  }, []);

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
