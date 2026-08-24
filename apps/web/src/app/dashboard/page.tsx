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
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import { SectionTitle, TextSmall } from '@/components/ui/Typography';
import { cn } from '@/lib/cn';
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
    <div className="max-w-content mx-auto px-6 py-8 space-y-8">
      <PageHero
        eyebrow="Products"
        title={isEmpty ? 'Create your first product' : 'Your GTM workspace'}
        description={
          isEmpty
            ? 'Point Aurora at a website or docs URL. It builds a product profile, then your agents can sell from real knowledge.'
            : dashboardSubtitle(role)
        }
        actions={
          <Button onClick={() => setShowCreate(true)}>
            {isEmpty ? 'Create your first product' : '+ Onboard Product'}
          </Button>
        }
      />

      <OnboardingChecklist
        hasProduct={!isEmpty}
        firstProductId={productList[0]?.id}
        onCreateProduct={() => setShowCreate(true)}
      />

      {isEmpty ? null : (
        <div className="grid md:grid-cols-2 gap-4">
          {productList.map((p, i) => (
              <Card
                key={p.id}
                elevated
                hover
                className={cn('animate-fade-up', `stagger-${Math.min(i + 1, 6)}`)}
              >
                <CardBody>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface font-semibold text-body-sm text-foreground"
                        aria-hidden
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <SectionTitle as="h3">{p.name}</SectionTitle>
                        {p.website_url && (
                          <TextSmall className="mt-1 truncate">{p.website_url}</TextSmall>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={p.profile_status === 'ready' ? 'success' : 'warning'}>
                        {p.profile_status}
                      </Badge>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          disabled={deletingId === p.id}
                          aria-label={`Remove ${p.name}`}
                          title="Remove product"
                          className="text-muted hover:text-danger transition-colors disabled:opacity-50"
                        >
                          {deletingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </CardBody>
                <CardFooter className="flex gap-2">
                  <Link href={actions.primary.href(p.id)} className="flex-1">
                    <Button className="w-full">{actions.primary.label}</Button>
                  </Link>
                  <Link href={actions.secondary.href(p.id)} className="flex-1">
                    <Button variant="secondary" className="w-full">{actions.secondary.label}</Button>
                  </Link>
                </CardFooter>
              </Card>
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
