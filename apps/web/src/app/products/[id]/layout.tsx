'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { products, type Product } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ProductProvider } from '@/context/ProductContext';
import { ProductShell } from '@/components/layout/ProductShell';

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
      <div className="min-h-screen flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  return (
    <ProductProvider productId={id} product={product} loading={loading}>
      <ProductShell>{children}</ProductShell>
    </ProductProvider>
  );
}
