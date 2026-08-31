import { Suspense } from 'react';
import PublicInboundFormPage from './PublicInboundForm';

export default function EmbedInboundPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--app-canvas)]" />}>
      <PublicInboundFormPage />
    </Suspense>
  );
}
