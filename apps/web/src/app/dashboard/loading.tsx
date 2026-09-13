import { SkeletonHero, SkeletonCard } from '@/components/ui/Skeleton';

/** Next.js App Router shows this automatically during route transitions into any
 * /dashboard/* segment that doesn't define its own loading.tsx -- previously there
 * was no route-level loading UI anywhere in the app, so navigation was a blank flash. */
export default function DashboardLoading() {
  return (
    <div className="max-w-container-app mx-auto px-[var(--hs-gutter)] py-8 space-y-8">
      <SkeletonHero />
      <div className="grid md:grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
