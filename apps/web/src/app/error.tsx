'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full text-center apple-card px-8 py-10">
        <p className="text-eyebrow mb-3">Aurora</p>
        <h1 className="text-page-title font-semibold tracking-[-0.03em] text-foreground mb-2">
          Something went wrong
        </h1>
        <p className="text-body text-muted mb-8">
          An unexpected error occurred. You can try again, or head back to the dashboard.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/dashboard">
            <Button variant="secondary">Go to dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
