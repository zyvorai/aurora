'use client';

import { useEffect, useState } from 'react';
import { LifeBuoy, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { showToast } from '@/lib/toast';
import { PageHero } from '@/components/layout/PageHero';
import { Card } from '@/components/ui/Card';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';
import { portalAdmin, type TicketWithCustomer, type TicketStatus } from '@/lib/portal-api';

type FilterTab = 'all' | TicketStatus;

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_VARIANT: Record<TicketStatus, BadgeVariant> = {
  open: 'warning',
  in_progress: 'default',
  resolved: 'success',
  closed: 'default',
};

const PRIORITY_VARIANT: Record<string, BadgeVariant> = {
  low: 'default',
  medium: 'default',
  high: 'warning',
  urgent: 'danger',
};

export default function TicketsAdminPage() {
  const { ready, role } = useAuth();
  const [tab, setTab] = useState<FilterTab>('all');
  const [tickets, setTickets] = useState<TicketWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'admin') {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tab]);

  function refresh() {
    setLoading(true);
    portalAdmin
      .listAllTickets(tab === 'all' ? undefined : tab)
      .then(setTickets)
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load tickets'))
      .finally(() => setLoading(false));
  }

  async function handleStatusChange(ticketId: string, status: TicketStatus) {
    setBusyId(ticketId);
    try {
      await portalAdmin.updateTicketStatus(ticketId, status);
      showToast('success', 'Ticket updated');
      refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update ticket');
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) {
    return <div className="max-w-content mx-auto px-6 py-8 text-muted">Loading…</div>;
  }

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
        icon={LifeBuoy}
        eyebrow="Admin"
        title="Support Tickets"
        description="Customer-reported issues, triaged by status."
      />

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'px-4 py-2 rounded-full text-body-sm font-medium transition-colors focus-ring',
              tab === t.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted hover:text-foreground hover:bg-[var(--glass-bg)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : tickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No tickets" description="Customer-reported issues will appear here." />
      ) : (
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Subject</TableHeaderCell>
                <TableHeaderCell>Customer</TableHeaderCell>
                <TableHeaderCell>Priority</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Opened</TableHeaderCell>
                <TableHeaderCell>{''}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>{ticket.subject}</TableCell>
                  <TableCell>{ticket.customer_company_name || ticket.customer_email}</TableCell>
                  <TableCell>
                    <Badge variant={PRIORITY_VARIANT[ticket.priority]}>{ticket.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[ticket.status]}>{ticket.status.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <select
                      value={ticket.status}
                      disabled={busyId === ticket.id}
                      onChange={(e) => handleStatusChange(ticket.id, e.target.value as TicketStatus)}
                      className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-md px-2 py-1 text-body-sm text-foreground focus-ring"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
