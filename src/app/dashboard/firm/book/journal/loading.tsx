import { SkeletonRows } from "@/app/dashboard/DashboardSkeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonRows count={6} />
    </div>
  );
}
