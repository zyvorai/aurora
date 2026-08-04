'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Product } from '@/lib/api';

interface ProductContextValue {
  product: Product | null;
  productId: string;
  loading: boolean;
}

const ProductContext = createContext<ProductContextValue>({
  product: null,
  productId: '',
  loading: true,
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
