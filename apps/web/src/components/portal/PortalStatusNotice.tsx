import { Clock, ShieldAlert, ShieldX } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

type PortalAccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

const COPY: Record<
  Exclude<PortalAccountStatus, 'approved'>,
  { icon: typeof Clock; title: string; description: string; tone: 'sky' | 'amber' | 'violet' | 'teal' }
> = {
  pending: {
    icon: Clock,
    title: 'Waiting for admin approval',
    description:
      'Your request is in the queue. An Aurora administrator will review it and you’ll be able to use this portal once approved.',
    tone: 'amber',
  },
  rejected: {
    icon: ShieldX,
    title: 'Access was not approved',
    description:
      'This account was rejected. Contact your Aurora administrator if you believe this was a mistake, or request access again from the signup page.',
    tone: 'violet',
  },
  suspended: {
    icon: ShieldAlert,
    title: 'Account suspended',
    description:
      'Portal access is paused. Contact your Aurora administrator to restore access.',
    tone: 'teal',
  },
};

export function PortalStatusNotice({
  status,
  signupHref,
}: {
  status: PortalAccountStatus;
  signupHref?: string;
}) {
  if (status === 'approved') return null;
  const copy = COPY[status];
  return (
    <EmptyState
      icon={copy.icon}
      tone={copy.tone}
      title={copy.title}
      description={copy.description}
      actions={
        status === 'rejected' && signupHref
          ? [{ label: 'Request access again', onClick: () => { window.location.href = signupHref; }, primary: true }]
          : undefined
      }
    />
  );
}
