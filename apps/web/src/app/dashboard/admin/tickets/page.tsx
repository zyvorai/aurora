'use client';

import { useEffect, useState } from 'react';
import { LifeBuoy, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { showToast } from '@/lib/toast';
import { PageHero } from '@/components/layout/PageHero';
import { WorkspacePage, WorkspacePanel, WorkspaceTabPills } from '@/components/layout/WorkspacePanel';
import { SkeletonHero, SkeletonTable } from '@/components/ui/Skeleton';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
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
  const [detailTicket, setDetailTicket] = useState<TicketWithCustomer | null>(null);

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
      const updated = await portalAdmin.updateTicketStatus(ticketId, status);
      showToast('success', 'Ticket updated');
      setDetailTicket((prev) => (prev && prev.id === ticketId ? { ...prev, ...updated } : prev));
      refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update ticket');
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) {
    return (
      <div className="max-w-container-app mx-auto px-[var(--hs-gutter)] py-8 space-y-8">
        <SkeletonHero />
        <SkeletonTable />
      </div>
    );
  }

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
          icon={LifeBuoy}
          eyebrow="Admin"
          title="Support Tickets"
          description="Customer-reported issues, triaged by status."
        />

        <WorkspaceTabPills
          tabs={TABS.map((t) => t.value)}
          active={tab}
          onChange={setTab}
          labels={Object.fromEntries(TABS.map((t) => [t.value, t.label])) as Record<FilterTab, string>}
        />

        {loading ? (
          <SkeletonTable />
        ) : tickets.length === 0 ? (
          <EmptyState icon={LifeBuoy} tone="pink" title="No tickets" description="Customer-reported issues will appear here." />
        ) : (
          <WorkspacePanel title="Tickets" description={`${tickets.length} in queue`}>
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
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setDetailTicket(ticket)}
                      className="text-left hover:text-primary hover:underline focus-ring rounded-sm"
                    >
                      {ticket.subject}
                    </button>
                  </TableCell>
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
                      className="apple-select apple-select-compact"
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
          </WorkspacePanel>
        )}

        <Modal
        open={detailTicket !== null}
        onClose={() => setDetailTicket(null)}
        title={detailTicket?.subject ?? ''}
      >
        {detailTicket && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={PRIORITY_VARIANT[detailTicket.priority]}>{detailTicket.priority}</Badge>
              <Badge variant={STATUS_VARIANT[detailTicket.status]}>{detailTicket.status.replace('_', ' ')}</Badge>
              <span className="text-muted text-body-sm">
                {detailTicket.customer_company_name || detailTicket.customer_email}
              </span>
            </div>
            <p className="text-body-sm whitespace-pre-wrap">{detailTicket.description}</p>
            <div className="text-muted text-body-sm">
              Opened {new Date(detailTicket.created_at).toLocaleString()}
              {detailTicket.resolved_at && (
                <> · Resolved {new Date(detailTicket.resolved_at).toLocaleString()}</>
              )}
            </div>
            <div>
              <label className="text-body-sm text-muted mb-1.5 block">Status</label>
              <select
                value={detailTicket.status}
                disabled={busyId === detailTicket.id}
                onChange={(e) => handleStatusChange(detailTicket.id, e.target.value as TicketStatus)}
                className="apple-select"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        )}
      </Modal>
      </WorkspacePage>
    </div>
  );
}
