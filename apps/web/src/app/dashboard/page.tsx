'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { products, type Product } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/hooks/useAuth';
import { dashboardActionsForRole, dashboardSubtitle, defaultProductRoute } from '@/lib/role-routing';
import { PageHero } from '@/components/layout/PageHero';
import { WorkspacePage } from '@/components/layout/WorkspacePanel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import { TextSmall } from '@/components/ui/Typography';
import { SkeletonHero, SkeletonCard } from '@/components/ui/Skeleton';
import { SourceLink } from '@/components/sources/SourceLink';
import { TONE_CLASSES, TONE_ROTATION } from '@/lib/tone';
import type { Tone } from '@/components/layout/PageHero';
import { cn } from '@/lib/cn';
import styles from './dashboard.module.css';

type ProductFilter = 'all' | 'ready' | 'setup';

const TONE_ACCENT: Record<Tone, string> = {
  sky: '#0071e3',
  violet: '#8b6fa0',
  emerald: '#6b7f52',
  amber: '#f77e2d',
  pink: '#c45c8a',
  teal: '#32374a',
  rust: '#e06a1c',
};

function productSubline(product: Product): string {
  if (product.description?.trim()) {
    return product.description.trim();
  }
  if (product.profile_status === 'ready') {
    return 'Profile ready — agents can sell from real knowledge.';
  }
  return 'Run ingest in Workspace to build the product profile.';
}

function statusLabel(status: string): string {
  if (status === 'ready') return 'Ready';
  if (status === 'pending') return 'Setup';
  return status.replace(/_/g, ' ');
}

function avatarTone(index: number): Tone {
  return TONE_ROTATION[index % TONE_ROTATION.length];
}

export default function DashboardPage() {
  const router = useRouter();
  const { role } = useAuth();
  const [productList, setProductList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', website_url: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [search, setSearch] = useState('');

  const actions = dashboardActionsForRole(role);
  const canDelete = role === 'admin' || role === 'editor';

  async function handleDelete(product: Product) {
    if (!confirm(`Remove "${product.name}"? This can be restored by an admin later, but it disappears from the dashboard immediately.`)) return;
    setDeletingId(product.id);
    try {
      await products.delete(product.id);
      setProductList((prev) => prev.filter((p) => p.id !== product.id));
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to remove product');
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    products.list()
      .then(setProductList)
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load products'))
      .finally(() => setLoading(false));
  }, []);

  function openCreateModal() {
    setShowCreate(true);
    setCreateError('');
  }

  function closeCreateModal() {
    setShowCreate(false);
    setCreateError('');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setCreateError('');
    const websiteUrl = form.website_url.trim();
    try {
      const product = await products.create(form);
      setProductList([product, ...productList]);
      setShowCreate(false);
      setForm({ name: '', website_url: '', description: '' });
      if (websiteUrl) {
        try {
          await products.addSource(product.id, {
            source_type: 'website',
            url: websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`,
          });
          await products.ingest(product.id, { async_mode: true });
        } catch {
          // Product exists; Forge still shows next steps if ingest failed.
        }
      }
      router.push(defaultProductRoute(product.id, role));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create product';
      setCreateError(message);
      showToast('error', message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={cn(styles.page, 'max-w-content mx-auto px-[var(--hs-gutter)] py-10 space-y-8 lg:px-8')}>
        <SkeletonHero />
        <div className={styles.grid}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const isEmpty = productList.length === 0;
  const readyCount = productList.filter((p) => p.profile_status === 'ready').length;
  const setupCount = productList.length - readyCount;

  const filteredProducts = productList.filter((p) => {
    if (filter === 'ready' && p.profile_status !== 'ready') return false;
    if (filter === 'setup' && p.profile_status === 'ready') return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const haystack = `${p.name} ${p.description ?? ''} ${p.website_url ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const filterLabels: { key: ProductFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: productList.length },
    { key: 'ready', label: 'Ready', count: readyCount },
    { key: 'setup', label: 'Setup', count: setupCount },
  ];

  return (
    <div className={cn(styles.page, 'max-w-content mx-auto px-[var(--hs-gutter)] py-10 lg:px-8')}>
      <WorkspacePage>
        <PageHero
          variant="display"
          eyebrow="Aurora"
          title={isEmpty ? 'Create your first product' : 'Your products'}
          description={
            isEmpty
              ? 'Point Aurora at a website or docs URL. It builds a product profile, then your agents can sell from real knowledge.'
              : dashboardSubtitle(role)
          }
          actions={
            isEmpty ? undefined : (
              <Button onClick={openCreateModal}>+ Onboard product</Button>
            )
          }
        />

        <OnboardingChecklist
          hasProduct={!isEmpty}
          firstProductId={productList[0]?.id}
          onCreateProduct={openCreateModal}
        />

        {!isEmpty && (
          <section>
            <div className="apple-stat-strip mb-8">
              <div>
                <p className="apple-stat-value">{productList.length}</p>
                <p className="apple-stat-label">Products</p>
              </div>
              <div>
                <p className="apple-stat-value" style={{ color: 'var(--accent-sage)' }}>{readyCount}</p>
                <p className="apple-stat-label">Ready to sell</p>
              </div>
              <div>
                <p className="apple-stat-value" style={{ color: 'var(--accent-blue)' }}>{setupCount}</p>
                <p className="apple-stat-label">Need ingest</p>
              </div>
            </div>

            <div className={styles.toolbar}>
              {productList.length > 6 ? (
                <Input
                  type="search"
                  placeholder="Search products…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-64"
                  aria-label="Search products"
                />
              ) : null}
              <div className="apple-segments ml-auto" role="tablist" aria-label="Filter products">
                {filterLabels.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.key}
                    data-active={filter === f.key}
                    className="apple-segment"
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                    <span className="ml-1 opacity-60 tabular-nums">{f.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.grid}>
              {filteredProducts.length === 0 ? (
                <p className="col-span-full text-center text-[15px] text-muted py-16">
                  {search.trim()
                    ? <>No products match &ldquo;{search.trim()}&rdquo;.{' '}
                      <button type="button" className="apple-link" onClick={() => setSearch('')}>Clear search</button>
                    </>
                    : <>No products match this filter.{' '}
                      <button type="button" className="apple-link" onClick={() => setFilter('all')}>Show all</button>
                    </>}
                </p>
              ) : null}
              {filteredProducts.map((p, index) => {
                const tone = avatarTone(index);
                const toneClasses = TONE_CLASSES[tone];
                const isReady = p.profile_status === 'ready';

                return (
                  <article
                    key={p.id}
                    className={styles.card}
                    style={{ '--card-accent': TONE_ACCENT[tone] } as React.CSSProperties}
                  >
                    <div className={styles.cardTop}>
                      <span
                        className={cn(styles.avatar, toneClasses.bg, toneClasses.text)}
                        aria-hidden
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                      <div className={styles.meta}>
                        <div className="flex items-start justify-between gap-2">
                          <h2 className={styles.name}>{p.name}</h2>
                          <Badge
                            variant={isReady ? 'success' : 'warning'}
                            className={cn(
                              'shrink-0 capitalize text-[11px]',
                              isReady ? styles.statusReady : styles.statusPending,
                            )}
                          >
                            {statusLabel(p.profile_status)}
                          </Badge>
                        </div>
                        <p className={styles.subline}>{productSubline(p)}</p>
                        {p.website_url ? (
                          <div className="mt-1">
                            <SourceLink urlOrKey={p.website_url} variant="compact" stopPropagation />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <Link href={actions.primary.href(p.id)} className={styles.linkPrimary}>
                        {actions.primary.label} →
                      </Link>
                      <Link href={actions.secondary.href(p.id)} className={styles.linkSecondary}>
                        {actions.secondary.label}
                      </Link>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          disabled={deletingId === p.id}
                          aria-label={`Remove ${p.name}`}
                          title="Remove product"
                          className={styles.deleteBtn}
                        >
                          {deletingId === p.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <Modal
          open={showCreate}
          onClose={closeCreateModal}
          title={isEmpty ? 'Create your first product' : 'Onboard product'}
        >
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && <TextSmall className="text-danger">{createError}</TextSmall>}
            <Input
              type="text"
              placeholder="Product name"
              required
              disabled={submitting}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              type="url"
              placeholder="Website URL (e.g. https://example.com)"
              disabled={submitting}
              value={form.website_url}
              onChange={(e) => setForm({ ...form, website_url: e.target.value })}
            />
            <Textarea
              placeholder="Description (optional)"
              rows={3}
              disabled={submitting}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" disabled={submitting} onClick={closeCreateModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create product'}
              </Button>
            </div>
          </form>
        </Modal>
      </WorkspacePage>
    </div>
  );
}
