'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Product } from '@/lib/api';

interface ProductContextValue {
  product: Product | null;
  productId: string;
  loading: boolean;
}

// Default (no <ProductProvider> ancestor -- e.g. /dashboard/* pages that aren't
// scoped to a product) is "not loading, no product", not "loading forever". Only
// pages actually wrapped in a ProductProvider (see products/[id]/layout.tsx) start
// out loading while they fetch the product.
const ProductContext = createContext<ProductContextValue>({
  product: null,
  productId: '',
  loading: false,
});

export function ProductProvider({
  productId,
  product,
  loading,
  children,
}: {
  productId: string;
  product: Product | null;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <ProductContext.Provider value={{ product, productId, loading }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProduct() {
  return useContext(ProductContext);
}
