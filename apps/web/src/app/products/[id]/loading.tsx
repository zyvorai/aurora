import { SkeletonHero } from '@/components/ui/Skeleton';

/** Shown by Next.js during navigation between /products/[id]/* tabs (Forge, brief,
 * sales, pipeline, marketing, partner) while that segment doesn't define its own
 * loading.tsx -- see apps/web/src/app/dashboard/loading.tsx for the same pattern. */
export default function ProductLoading() {
  return (
    <div className="max-w-content mx-auto px-6 py-8">
      <SkeletonHero />
    </div>
  );
}
