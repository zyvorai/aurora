'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LifeBuoy, Pencil, Plus } from 'lucide-react';
import { GlobalNav } from '@/components/layout/GlobalNav/GlobalNav';
import { PageHero } from '@/components/layout/PageHero';
import { KpiStrip, WorkspacePage, WorkspacePanel } from '@/components/layout/WorkspacePanel';
import { SkeletonLine } from '@/components/ui/Skeleton';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { showToast } from '@/lib/toast';
import { portal, type CustomerAccount, type Ticket, type TicketPriority } from '@/lib/portal-api';
import { clearPortalSession, getPortalToken } from '@/lib/portal-auth';
import { PortalStatusNotice } from '@/components/portal/PortalStatusNotice';

const STATUS_VARIANT: Record<CustomerAccount['status'], BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

const TICKET_STATUS_VARIANT: Record<Ticket['status'], BadgeVariant> = {
  open: 'warning',
  in_progress: 'default',
  resolved: 'success',
  closed: 'default',
};

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function CustomerHomePage() {
  const router = useRouter();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ company_name: '', contact_name: '' });
  const [saving, setSaving] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', priority: 'medium' as TicketPriority });
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketError, setTicketError] = useState('');

  useEffect(() => {
    if (!getPortalToken()) {
      router.replace('/portal/customer/login');
      return;
    }
    Promise.all([portal.me(), portal.myTickets().catch(() => [])])
      .then(([me, myTickets]) => {
        setAccount(me);
        setTickets(myTickets);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Session expired');
        clearPortalSession();
        router.replace('/portal/customer/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleSignOut() {
    clearPortalSession();
    router.push('/portal/customer/login');
  }

  function openEditModal() {
    if (!account) return;
    setEditForm({ company_name: account.company_name || '', contact_name: account.contact_name || '' });
    setShowEditModal(true);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await portal.updateMe(editForm);
      setAccount(updated);
      setShowEditModal(false);
      showToast('success', 'Profile updated');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingTicket(true);
    setTicketError('');
    try {
      const ticket = await portal.createTicket(ticketForm);
      setTickets([ticket, ...tickets]);
      setShowTicketModal(false);
      setTicketForm({ subject: '', description: '', priority: 'medium' });
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : 'Failed to submit ticket');
    } finally {
      setSubmittingTicket(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SkeletonLine className="w-40 h-4" />
      </div>
    );
  }

  if (error || !account) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <GlobalNav variant="portal" portalLabel="Customer Portal" onSignOut={handleSignOut} />

      <main className="flex-1 max-w-container-app mx-auto px-[var(--hs-gutter)] py-10 w-full">
        <WorkspacePage>
          <PageHero
            eyebrow="Account"
            title={account.company_name || account.contact_name || account.email}
            description="Your account status and details."
            actions={
              <Button variant="secondary" size="sm" onClick={openEditModal}>
                <Pencil className="w-4 h-4 mr-1.5" aria-hidden /> Edit profile
              </Button>
            }
          />

          <KpiStrip
            items={[
              { label: 'Status', value: account.status },
              { label: 'Tickets', value: tickets.length },
              { label: 'Member since', value: new Date(account.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) },
              { label: 'Email', value: account.email.split('@')[0] },
            ]}
          />

          <WorkspacePanel title="Account details" bodyClassName="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-muted text-[13px]">Status</span>
              <Badge variant={STATUS_VARIANT[account.status]}>{account.status}</Badge>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-muted text-[13px]">Email</span>
              <span className="text-[13px]">{account.email}</span>
            </div>
            {account.contact_name && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-muted text-[13px]">Contact</span>
                <span className="text-[13px]">{account.contact_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-muted text-[13px]">Member since</span>
              <span className="text-[13px]">{new Date(account.created_at).toLocaleDateString()}</span>
            </div>
          </WorkspacePanel>

          <PortalStatusNotice status={account.status} signupHref="/portal/customer/signup" />

          {account.status === 'approved' && (
            <WorkspacePanel
              title="Support"
              description={`${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`}
              actions={
                <Button size="sm" onClick={() => setShowTicketModal(true)}>
                  <Plus className="w-4 h-4 mr-1.5" aria-hidden /> New ticket
                </Button>
              }
            >
              {tickets.length === 0 ? (
                <div className="p-4">
                  <EmptyState icon={LifeBuoy} tone="sky" title="No tickets yet" description="Run into an issue? Open a ticket and we'll take a look." />
                </div>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Subject</TableHeaderCell>
                      <TableHeaderCell>Priority</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Opened</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell>{ticket.subject}</TableCell>
                        <TableCell className="capitalize">{ticket.priority}</TableCell>
                        <TableCell>
                          <Badge variant={TICKET_STATUS_VARIANT[ticket.status]}>
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </WorkspacePanel>
          )}
        </WorkspacePage>
      </main>

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit profile">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            placeholder="Company name"
            value={editForm.company_name}
            onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
          />
          <Input
            placeholder="Your name"
            value={editForm.contact_name}
            onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={showTicketModal} onClose={() => setShowTicketModal(false)} title="New support ticket">
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <Input
            placeholder="What's the issue?"
            required
            value={ticketForm.subject}
            onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
          />
          <Textarea
            placeholder="Describe what happened, steps to reproduce, etc."
            required
            rows={4}
            value={ticketForm.description}
            onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
          />
          <div className="apple-segments w-full" role="group" aria-label="Ticket priority">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setTicketForm({ ...ticketForm, priority: p.value })}
                className="apple-segment"
                data-active={ticketForm.priority === p.value}
              >
                {p.label}
              </button>
            ))}
          </div>
          {ticketError && <p className="text-danger text-body-sm">{ticketError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowTicketModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingTicket}>
              {submittingTicket ? 'Submitting…' : 'Submit ticket'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
