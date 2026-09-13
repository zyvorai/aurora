'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { showToast } from '@/lib/toast';
import { PageHero } from '@/components/layout/PageHero';
import { WorkspacePage, WorkspacePanel } from '@/components/layout/WorkspacePanel';
import { SkeletonHero, SkeletonTable } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { portalAdmin, type SalesPersonActivity } from '@/lib/portal-api';

export default function SalesActivityAdminPage() {
  const { ready, role } = useAuth();
  const [activity, setActivity] = useState<SalesPersonActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role === 'admin') {
      portalAdmin
        .salesActivity()
        .then(setActivity)
        .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load activity'))
        .finally(() => setLoading(false));
    }
  }, [role]);

  if (!ready) {
    return (
      <div className="max-w-container-app mx-auto px-[var(--hs-gutter)] py-8 space-y-8">
        <SkeletonHero />
        <SkeletonTable />
      </div>
    );
  }

  // Same pattern as the other admin pages: a non-admin should never see this render at
  // all, not just fail on submit.
  if (role !== 'admin') {
    return (
      <div className="max-w-container-app mx-auto px-[var(--hs-gutter)] py-8">
        <EmptyState
          icon={ShieldAlert}
          title="Admin access required"
          description="This page is restricted to admin users."
        />
      </div>
    );
  }

  return (
    <div className="max-w-container-app mx-auto px-[var(--hs-gutter)] py-8">
      <WorkspacePage>
        <PageHero
          icon={TrendingUp}
          eyebrow="Admin"
          title="Sales Activity"
          description="Who's working which client, and at what stage."
        />

        {loading ? (
          <SkeletonTable />
        ) : activity.length === 0 ? (
          <EmptyState
            icon={Users}
            tone="emerald"
            title="No approved sales reps yet"
            description="Approve sales-rep portal signups to see their activity here."
          />
        ) : (
          activity.map((entry) => {
            const totalAssigned = entry.leads.length + entry.opportunities.length;
            const repName = entry.salesperson.contact_name || entry.salesperson.email;
            return (
              <WorkspacePanel
                key={entry.salesperson.id}
                title={repName}
                description={
                  entry.salesperson.territory
                    ? `${entry.salesperson.territory} · ${entry.salesperson.email}`
                    : entry.salesperson.email
                }
                actions={<Badge variant="default">{totalAssigned} assigned</Badge>}
              >
                {totalAssigned > 0 ? (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Client</TableHeaderCell>
                        <TableHeaderCell>Type</TableHeaderCell>
                        <TableHeaderCell>Stage</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {entry.leads.map((lead) => (
                        <TableRow key={`lead-${lead.id}`}>
                          <TableCell>{lead.company || lead.name || '—'}</TableCell>
                          <TableCell>Lead</TableCell>
                          <TableCell className="capitalize">{lead.stage}</TableCell>
                        </TableRow>
                      ))}
                      {entry.opportunities.map((opp) => (
                        <TableRow key={`opp-${opp.id}`}>
                          <TableCell>{opp.company || opp.name}</TableCell>
                          <TableCell>Opportunity</TableCell>
                          <TableCell className="capitalize">{opp.stage}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="px-4 py-3.5 text-muted text-[13px]">No leads or opportunities assigned yet.</p>
                )}
              </WorkspacePanel>
            );
          })
        )}
      </WorkspacePage>
    </div>
  );
}
