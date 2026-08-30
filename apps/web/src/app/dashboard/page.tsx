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
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import { Text, TextSmall } from '@/components/ui/Typography';
import { SkeletonHero, SkeletonCard } from '@/components/ui/Skeleton';

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
      // Mirror signup: if a website URL was provided, kick off ingest so the
      // new user lands on Forge already making progress.
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
      <div className="max-w-content mx-auto px-6 py-8 space-y-8">
        <SkeletonHero />
        <div className="grid md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const isEmpty = productList.length === 0;

  return (
    <div className="max-w-content mx-auto px-6 py-10 space-y-8">
      <PageHero
        eyebrow="Aurora"
        title={isEmpty ? 'Create your first product' : 'Your products'}
        description={
          isEmpty
            ? 'Point Aurora at a website or docs URL. It builds a product profile, then your agents can sell from real knowledge.'
            : dashboardSubtitle(role)
        }
        actions={
          isEmpty ? undefined : (
            <Button onClick={() => setShowCreate(true)}>+ Onboard product</Button>
          )
        }
      />

      <OnboardingChecklist
        hasProduct={!isEmpty}
        firstProductId={productList[0]?.id}
        onCreateProduct={() => setShowCreate(true)}
      />

      {isEmpty ? null : (
        <div className="rounded-[var(--radius-lg)] bg-background divide-y divide-border overflow-hidden animate-fade-up">
          {productList.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface font-semibold text-body-sm text-foreground"
                aria-hidden
              >
                {p.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <Text className="font-medium">{p.name}</Text>
                {p.website_url && <TextSmall className="block truncate text-muted">{p.website_url}</TextSmall>}
              </div>
              <Badge variant={p.profile_status === 'ready' ? 'success' : 'warning'} className="shrink-0">
                {p.profile_status}
              </Badge>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link href={actions.primary.href(p.id)}>
                  <Button size="sm">{actions.primary.label}</Button>
                </Link>
                <Link href={actions.secondary.href(p.id)}>
                  <Button size="sm" variant="secondary">{actions.secondary.label}</Button>
                </Link>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    disabled={deletingId === p.id}
                    aria-label={`Remove ${p.name}`}
                    title="Remove product"
                    className="p-1.5 text-muted hover:text-danger transition-colors disabled:opacity-50"
                  >
                    {deletingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={closeCreateModal} title="Create your first product">
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
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" disabled={submitting} onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create product'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
