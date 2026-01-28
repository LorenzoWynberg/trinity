export default function StoriesLoading() {
  return (
    <div className="p-8 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
          <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
        </div>
      </div>

      {/* Filter skeletons */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-4 w-8 bg-muted animate-pulse rounded" />
          <div className="h-9 w-[160px] bg-muted animate-pulse rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          <div className="h-9 w-[200px] bg-muted animate-pulse rounded-md" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="h-10 w-full max-w-xl bg-muted animate-pulse rounded-md" />

      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}
