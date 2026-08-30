'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { useProduct } from '@/context/ProductContext';
import { PageHero } from '@/components/layout/PageHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import ProductProfileView from '@/components/ProductProfileView';

export default function PartnerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { product } = useProduct();
  const hasProfile = Boolean(product?.profile && Object.keys(product.profile).length > 0);

  return (
    <div className="space-y-10 animate-fade-up">
      <PageHero
        eyebrow="Partners"
        title="Partner enablement"
        description="Internal view for partner-facing material — read-only product facts and co-branded templates."
      />

      <section>
        <SectionHeader title="Product facts" />
        {hasProfile ? (
          <div className="rounded-[var(--radius-lg)] bg-surface px-5 py-5">
            <ProductProfileView profile={product!.profile!} />
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No product facts yet"
            description="Partner material is generated from the product profile so numbers match what sales says. Build the profile in Workspace first."
            actions={[{ label: 'Open Workspace', onClick: () => router.push(`/products/${id}`) }]}
          />
        )}
      </section>

      <section>
        <SectionHeader title="Co-branded assets" />
        <Link href={`/products/${id}?tab=outreach`}>
          <Button variant="secondary">Co-branded outreach template</Button>
        </Link>
      </section>
    </div>
  );
}
