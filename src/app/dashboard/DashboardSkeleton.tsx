export function SkeletonCard() {
  return (
    <div className="ledger-sheet animate-pulse rounded-sm border border-ink-700 p-6">
      <div className="h-3 w-24 rounded-sm bg-ink-900/10" />
      <div className="mt-3 h-8 w-32 rounded-sm bg-ink-900/10" />
    </div>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="ledger-sheet animate-pulse overflow-hidden rounded-sm border border-ink-700">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-b border-ink-900/10 px-5 py-4 last:border-b-0">
          <div className="h-3 w-2/3 rounded-sm bg-ink-900/10" />
        </div>
      ))}
    </div>
  );
}
