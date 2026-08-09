'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { showToast } from '@/lib/toast';
import { PageHero } from '@/components/layout/PageHero';
import { Card, CardBody } from '@/components/ui/Card';
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
    return <div className="max-w-content mx-auto px-6 py-8 text-muted">Loading…</div>;
  }

  // Same pattern as the other admin pages: a non-admin should never see this render at
  // all, not just fail on submit.
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
    <div className="max-w-content mx-auto px-6 py-8 space-y-8">
      <PageHero
        icon={TrendingUp}
        eyebrow="Admin"
        title="Sales Activity"
        description="Who's working which client, and at what stage."
      />

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : activity.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No approved sales reps yet"
          description="Approve sales-rep portal signups to see their activity here."
        />
      ) : (
        <div className="space-y-6">
          {activity.map((entry) => {
            const totalAssigned = entry.leads.length + entry.opportunities.length;
            return (
              <Card key={entry.salesperson.id}>
                <CardBody className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">
                        {entry.salesperson.contact_name || entry.salesperson.email}
                      </div>
                      <div className="text-muted text-body-sm">
                        {entry.salesperson.territory ? `Territory: ${entry.salesperson.territory} · ` : ''}
                        {entry.salesperson.email}
                      </div>
                    </div>
                    <Badge variant="default">{totalAssigned} assigned</Badge>
                  </div>

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
                    <p className="text-muted text-body-sm">No leads or opportunities assigned yet.</p>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
