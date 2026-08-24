import type { Metadata } from 'next';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { HomeSections } from '@/components/marketing/HomeSections';

export const metadata: Metadata = {
  title: 'Aurora — AI-powered GTM orchestration',
  description:
    'Turn your technical product into an AI-powered salesperson: auto-discovery, a grounded knowledge graph, and background marketing/sales/solution agents.',
};

export default function HomePage() {
  return (
    <MarketingLayout>
      <HomeSections />
    </MarketingLayout>
  );
}
