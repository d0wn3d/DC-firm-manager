import { SkeletonRows } from "@/app/dashboard/DashboardSkeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonRows count={4} />
      <SkeletonRows count={4} />
      <SkeletonRows count={3} />
    </div>
  );
}
