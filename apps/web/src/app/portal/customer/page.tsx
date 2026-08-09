'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, LifeBuoy, LogOut, Pencil, Plus, Sparkles } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { showToast } from '@/lib/toast';
import { portal, type CustomerAccount, type Ticket, type TicketPriority } from '@/lib/portal-api';
import { clearPortalSession, getPortalToken } from '@/lib/portal-auth';

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
    return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>;
  }

  if (error || !account) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--glass-border)] bg-[var(--glass-bg-elevated)] backdrop-blur-[var(--blur-liquid)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="tahoe-icon-badge !w-8 !h-8 !rounded-md">
            <Sparkles className="w-4 h-4" aria-hidden />
          </div>
          <span className="font-semibold">Customer Portal</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-1.5" aria-hidden /> Sign out
        </Button>
      </header>

      <main className="max-w-content mx-auto px-6 py-8 space-y-8">
        <PageHero
          icon={Building2}
          eyebrow="Account"
          title={account.company_name || account.contact_name || account.email}
          description="Your account status and details."
          actions={
            <Button variant="secondary" size="sm" onClick={openEditModal}>
              <Pencil className="w-4 h-4 mr-1.5" aria-hidden /> Edit profile
            </Button>
          }
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
            {account.contact_name && (
              <div className="flex items-center justify-between">
                <span className="text-muted text-body-sm">Contact</span>
                <span className="text-body-sm">{account.contact_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted text-body-sm">Member since</span>
              <span className="text-body-sm">{new Date(account.created_at).toLocaleDateString()}</span>
            </div>
          </CardBody>
        </Card>

        {account.status === 'approved' && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Support</h2>
              <Button size="sm" onClick={() => setShowTicketModal(true)}>
                <Plus className="w-4 h-4 mr-1.5" aria-hidden /> New ticket
              </Button>
            </div>
            {tickets.length === 0 ? (
              <EmptyState icon={LifeBuoy} title="No tickets yet" description="Run into an issue? Open a ticket and we'll take a look." />
            ) : (
              <Card>
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
              </Card>
            )}
          </section>
        )}
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
          <textarea
            placeholder="Describe what happened, steps to reproduce, etc."
            required
            rows={4}
            value={ticketForm.description}
            onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
            className="w-full px-4 py-2.5 bg-background border border-border rounded-md text-body text-foreground placeholder:text-muted focus-ring resize-none"
          />
          <div className="flex gap-2">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setTicketForm({ ...ticketForm, priority: p.value })}
                className={`flex-1 py-2 rounded-full text-body-sm font-medium transition-colors focus-ring ${
                  ticketForm.priority === p.value ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground bg-[var(--glass-bg)]'
                }`}
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
