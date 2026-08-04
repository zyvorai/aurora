'use client';

import { Suspense } from 'react';
import ProductForgePageInner from './ForgePage';

export default function ProductForgePage() {
  return (
    <Suspense fallback={<div className="text-muted">Loading forge…</div>}>
      <ProductForgePageInner />
    </Suspense>
  );
}
