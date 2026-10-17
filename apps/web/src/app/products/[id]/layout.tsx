'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { products, type Product } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ProductProvider } from '@/context/ProductContext';
import { ProductConsoleShell } from '@/components/layout/ProductConsoleShell';
import { SkeletonLine } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';

export default function ProductLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ready } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    products.get(id)
      .then(setProduct)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this product'))
      .finally(() => setLoading(false));
  }, [id, ready, attempt]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SkeletonLine className="w-40 h-4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-[var(--hs-gutter)]">
        <ErrorState title="Couldn't open this product" message={error} onRetry={() => setAttempt((n) => n + 1)} />
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>
          Back to products
        </Button>
      </div>
    );
  }

  return (
    <ProductProvider productId={id} product={product} loading={loading}>
      <ProductConsoleShell productId={id} product={product}>
        {children}
      </ProductConsoleShell>
    </ProductProvider>
  );
}
