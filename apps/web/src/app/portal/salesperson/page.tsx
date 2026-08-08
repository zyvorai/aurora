'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, LogOut, Sparkles, TrendingUp } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { salesPersonPortal, type SalesPersonAccount, type SalesPersonPipeline } from '@/lib/portal-api';
import { clearPortalSession, getPortalToken } from '@/lib/portal-auth';

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
        setPipeline(myPipeline);
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
          <span className="font-semibold">Sales Rep Portal</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-1.5" aria-hidden /> Sign out
        </Button>
      </header>

      <main className="max-w-content mx-auto px-6 py-8 space-y-8">
        <PageHero
          icon={Briefcase}
          eyebrow="Account"
          title={account.contact_name || account.email}
          description={account.territory ? `Territory: ${account.territory}` : 'My assigned pipeline'}
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
            <div className="flex items-center justify-between">
              <span className="text-muted text-body-sm">Commission rate</span>
              <span className="text-body-sm">{(account.commission_rate * 100).toFixed(1)}%</span>
            </div>
          </CardBody>
        </Card>

        {account.status === 'approved' && (
          <>
            <section>
              <h2 className="text-lg font-semibold mb-3">Assigned leads</h2>
              {pipeline.leads.length === 0 ? (
                <EmptyState icon={TrendingUp} title="No leads assigned yet" description="Leads assigned to you will appear here." />
              ) : (
                <Card>
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
                </Card>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Assigned opportunities</h2>
              {pipeline.opportunities.length === 0 ? (
                <EmptyState icon={Briefcase} title="No opportunities assigned yet" description="Opportunities assigned to you will appear here." />
              ) : (
                <Card>
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
                </Card>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
