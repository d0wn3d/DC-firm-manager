import { SkeletonCard, SkeletonRows } from "@/app/dashboard/DashboardSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonRows count={4} />
    </div>
  );
}
