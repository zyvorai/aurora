'use client';

import { useEffect, useState } from 'react';
import { resolveApiBase } from '@/lib/api-base';

interface LicenseStatus {
  licensed: boolean;
  trial_active: boolean;
  trial_expired: boolean;
  trial_days_remaining: number;
  contact?: string;
}

export function LicenseBanner() {
  const [status, setStatus] = useState<LicenseStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${resolveApiBase()}/license/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setStatus(data as LicenseStatus);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status || status.licensed) return null;
  if (!status.trial_active && !status.trial_expired) return null;

  const contact = status.contact || 'sales@zyvor.dev';
  if (status.trial_expired) {
    return (
      <div
        role="alert"
        className="text-center text-sm px-4 py-2.5 bg-[#1d1d1f] text-white"
      >
        Your 30-day trial has ended. Email{' '}
        <a className="underline underline-offset-2" href={`mailto:${contact}`}>
          {contact}
        </a>{' '}
        for a license key to continue.
      </div>
    );
  }

  if (status.trial_days_remaining > 7) return null;

  return (
    <div
      role="status"
      className="text-center text-sm px-4 py-2 bg-[#f5f5f7] text-[#1d1d1f] border-b border-black/5"
    >
      {status.trial_days_remaining} day{status.trial_days_remaining === 1 ? '' : 's'} left in your
      trial — email{' '}
      <a className="underline underline-offset-2" href={`mailto:${contact}`}>
        {contact}
      </a>{' '}
      for a license key.
    </div>
  );
}
