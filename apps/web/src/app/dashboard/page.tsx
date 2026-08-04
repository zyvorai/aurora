'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { products, type Product } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { dashboardActionsForRole, dashboardSubtitle, defaultProductRoute } from '@/lib/role-routing';
import { PageHero } from '@/components/layout/PageHero';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SectionTitle, TextMuted, TextSmall } from '@/components/ui/Typography';

export default function DashboardPage() {
  const router = useRouter();
  const { role } = useAuth();
  const [productList, setProductList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', website_url: '', description: '' });

  const actions = dashboardActionsForRole(role);

  useEffect(() => {
    products.list()
      .then(setProductList)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const product = await products.create(form);
    setProductList([product, ...productList]);
    setShowCreate(false);
    setForm({ name: '', website_url: '', description: '' });
    router.push(defaultProductRoute(product.id, role));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-body text-muted">
        Loading products…
      </div>
    );
  }

  return (
    <div className="max-w-content mx-auto px-6 py-8 space-y-8">
      <PageHero
        eyebrow="Products"
        title="Your GTM workspace"
        description={dashboardSubtitle(role)}
        actions={
          <Button onClick={() => setShowCreate(true)}>+ Onboard Product</Button>
        }
      />

      {productList.length === 0 ? (
        <Card elevated className="text-center py-16 animate-fade-up">
          <CardBody>
            <SectionTitle className="mb-2">No products yet</SectionTitle>
            <TextMuted className="mb-6 max-w-md mx-auto">
              Add your first product by providing a website URL or documentation.
            </TextMuted>
            <Button size="lg" onClick={() => setShowCreate(true)}>
              Onboard Your First Product
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {productList.map((p) => (
            <Card
              key={p.id}
              elevated
              className="hover:border-primary/40 transition-colors animate-fade-up"
            >
              <CardBody>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <SectionTitle as="h3">{p.name}</SectionTitle>
                    {p.website_url && (
                      <TextSmall className="mt-1 truncate">{p.website_url}</TextSmall>
                    )}
                  </div>
                  <Badge variant={p.profile_status === 'ready' ? 'success' : 'warning'}>
                    {p.profile_status}
                  </Badge>
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Onboard Product">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            type="text"
            placeholder="Product name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            type="url"
            placeholder="Website URL (e.g. https://example.com)"
            value={form.website_url}
            onChange={(e) => setForm({ ...form, website_url: e.target.value })}
          />
          <Textarea
            placeholder="Description (optional)"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
