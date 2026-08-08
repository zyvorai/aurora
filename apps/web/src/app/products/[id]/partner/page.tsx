'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useProduct } from '@/context/ProductContext';
import { PageHero } from '@/components/layout/PageHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import ProductProfileView from '@/components/ProductProfileView';

export default function PartnerPage() {
  const { id } = useParams<{ id: string }>();
  const { product } = useProduct();

  return (
    <div className="space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Partners"
        title="Partner Enablement"
        description="Internal view for prepping partner-facing material — read-only product facts and co-branded outreach templates. Not the reseller's own login; see the customer portal for external, self-service access."
      />

      <section>
        <SectionHeader label="Product facts" title="Profile" />
        <Card elevated>
          <CardBody>
            {product?.profile ? (
              <ProductProfileView profile={product.profile} />
            ) : (
              <p className="text-muted">Product profile not yet available.</p>
            )}
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeader label="Templates" title="Co-branded assets" />
        <Link href={`/products/${id}?tab=outreach`}>
          <Button variant="secondary">Co-branded outreach template</Button>
        </Link>
      </section>
    </div>
  );
}
