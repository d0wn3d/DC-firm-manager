import { SkeletonCard, SkeletonRows } from "@/app/dashboard/DashboardSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonCard />
      <SkeletonRows count={5} />
    </div>
  );
}
