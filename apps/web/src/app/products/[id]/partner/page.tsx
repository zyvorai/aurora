'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FileText, Send } from 'lucide-react';
import { useProduct } from '@/context/ProductContext';
import { PageHero } from '@/components/layout/PageHero';
import { WorkspacePage, WorkspacePanel } from '@/components/layout/WorkspacePanel';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import ProductProfileView from '@/components/ProductProfileView';
import forgeStyles from '@/components/workflow/forge.module.css';

export default function PartnerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { product } = useProduct();
  const hasProfile = Boolean(product?.profile && Object.keys(product.profile).length > 0);

  return (
    <WorkspacePage>
      <PageHero
        eyebrow="Partners"
        title="Partner enablement"
        description="Product facts and co-branded templates for reseller and channel partners."
      />

      <WorkspacePanel title="Product facts" description="Grounded in your ingested knowledge">
        {hasProfile ? (
          <div className="p-4 sm:p-5">
            <ProductProfileView profile={product!.profile!} />
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={FileText}
              title="No product facts yet"
              description="Partner material is generated from the product profile so numbers match what sales says."
              actions={[{ label: 'Open Workspace', onClick: () => router.push(`/products/${id}`) }]}
            />
          </div>
        )}
      </WorkspacePanel>

      <WorkspacePanel title="Co-branded assets" description="Templates partners can customize">
        <div className={forgeStyles.assetGrid}>
          <Link href={`/products/${id}?tab=outreach`} className={forgeStyles.assetCard}>
            <Send className="w-4 h-4 text-primary mb-1" aria-hidden />
            <p className={forgeStyles.assetTitle}>Outreach template</p>
            <p className={forgeStyles.assetDesc}>Personalized email sequence for partner-led deals.</p>
          </Link>
          <Link href={`/products/${id}?tab=proposal`} className={forgeStyles.assetCard}>
            <FileText className="w-4 h-4 text-primary mb-1" aria-hidden />
            <p className={forgeStyles.assetTitle}>Proposal shell</p>
            <p className={forgeStyles.assetDesc}>SOW and ROI framing grounded in product facts.</p>
          </Link>
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  );
}
