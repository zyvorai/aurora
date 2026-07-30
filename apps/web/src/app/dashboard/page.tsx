'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { products, type Product } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [productList, setProductList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', website_url: '', description: '' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/'); return; }
    products.list()
      .then(setProductList)
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const product = await products.create(form);
    setProductList([product, ...productList]);
    setShowCreate(false);
    setForm({ name: '', website_url: '', description: '' });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gtm-border px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-gtm-accent font-mono text-xs tracking-widest uppercase">GTM Platform</p>
          <h1 className="text-xl font-bold">Products</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-gtm-accent text-gtm-bg font-medium rounded-md hover:bg-[var(--accent-hover)] transition-colors"
        >
          + Onboard Product
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {productList.length === 0 ? (
          <div className="text-center py-20 animate-fade-up">
            <h2 className="text-2xl font-bold mb-2">No products yet</h2>
            <p className="text-[var(--text-secondary)] mb-6">
              Add your first product by providing a website URL or documentation.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-3 bg-gtm-accent text-gtm-bg font-semibold rounded-md"
            >
              Onboard Your First Product
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {productList.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="block bg-gtm-card border border-gtm-border rounded-lg p-6 hover:border-gtm-accent/50 transition-colors animate-fade-up"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    {p.website_url && (
                      <p className="text-[var(--text-secondary)] text-sm mt-1">{p.website_url}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    p.profile_status === 'ready'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {p.profile_status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-gtm-card border border-gtm-border rounded-lg p-8 w-full max-w-md">
            <h2 className="text-xl font-bold mb-6">Onboard Product</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="text" placeholder="Product name" required
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 bg-gtm-bg border border-gtm-border rounded-md text-white focus:outline-none focus:border-gtm-accent"
              />
              <input
                type="url" placeholder="Website URL (e.g. https://zyvor.dev)"
                value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                className="w-full px-4 py-3 bg-gtm-bg border border-gtm-border rounded-md text-white focus:outline-none focus:border-gtm-accent"
              />
              <textarea
                placeholder="Description (optional)" rows={3}
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-3 bg-gtm-bg border border-gtm-border rounded-md text-white focus:outline-none focus:border-gtm-accent resize-none"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 border border-gtm-border rounded-md text-[var(--text-secondary)]">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-3 bg-gtm-accent text-gtm-bg font-semibold rounded-md">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
