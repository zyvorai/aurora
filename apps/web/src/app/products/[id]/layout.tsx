'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { products, type Product } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ProductProvider } from '@/context/ProductContext';
import { ProductConsoleShell } from '@/components/layout/ProductConsoleShell';
import { SkeletonLine } from '@/components/ui/Skeleton';

export default function ProductLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ready } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    products.get(id)
      .then(setProduct)
      .catch(() => router.push('/dashboard'))
      .finally(() => setLoading(false));
  }, [id, ready, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SkeletonLine className="w-40 h-4" />
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
