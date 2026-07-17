import { SkeletonCard } from "@/app/dashboard/DashboardSkeleton";

export default function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
