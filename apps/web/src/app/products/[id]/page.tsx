'use client';

import { Suspense } from 'react';
import ProductForgePageInner from './ForgePage';
import { SkeletonHero } from '@/components/ui/Skeleton';

export default function ProductForgePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-container-app mx-auto px-6 py-8">
          <SkeletonHero />
        </div>
      }
    >
      <ProductForgePageInner />
    </Suspense>
  );
}
