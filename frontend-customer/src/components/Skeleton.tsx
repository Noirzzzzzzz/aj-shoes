export function RowSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-40 bg-zinc-800 rounded" />
      <div className="flex gap-3 overflow-x-auto scrollx-hide">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="min-w-40 w-40 h-56 bg-zinc-900 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
