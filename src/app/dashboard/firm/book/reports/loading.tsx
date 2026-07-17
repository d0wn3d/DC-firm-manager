import { SkeletonCard, SkeletonRows } from "@/app/dashboard/DashboardSkeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonCard />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonRows count={3} />
        <SkeletonRows count={3} />
      </div>
    </div>
  );
}
