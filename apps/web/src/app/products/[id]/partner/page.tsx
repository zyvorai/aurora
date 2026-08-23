'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useProduct } from '@/context/ProductContext';
import { PageHero } from '@/components/layout/PageHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import ProductProfileView from '@/components/ProductProfileView';
import { WORKSPACE_ICONS, WORKSPACE_COLORS } from '@/lib/nav-data';

export default function PartnerPage() {
  const { id } = useParams<{ id: string }>();
  const { product } = useProduct();

  return (
    <div className="space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Partners"
        title="Partner Enablement"
        description="Internal view for prepping partner-facing material — read-only product facts and co-branded outreach templates. Not the reseller's own login; see the customer portal for external, self-service access."
        icon={WORKSPACE_ICONS.partner}
        accent={WORKSPACE_COLORS.partner}
      />

      <section>
        <SectionHeader label="Product facts" title="Profile" />
        <Card elevated>
          <CardBody>
            {product?.profile && Object.keys(product.profile).length > 0 ? (
              <ProductProfileView profile={product.profile} />
            ) : (
              <div className="text-center py-8">
                <p className="font-medium text-foreground">No product facts yet</p>
                <p className="mt-1.5 text-body-sm text-muted max-w-[48ch] mx-auto">
                  Partner material is generated from the product profile so the numbers match what sales
                  says. Build the profile in Forge first.
                </p>
                <Link href={`/products/${id}`}>
                  <Button variant="secondary" className="mt-4">Go to Forge</Button>
                </Link>
              </div>
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
