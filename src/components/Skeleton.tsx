function Bone({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-elevated ${className}`}
    />
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-surface-card border border-border-subtle rounded-xl p-4 space-y-3 ${className}`}
    >
      <Bone className="h-3 w-1/3" />
      <Bone className="h-5 w-2/3" />
      <Bone className="h-3 w-1/2" />
    </div>
  )
}

export function SkeletonAtivo() {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="space-y-2 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Bone className="h-4 w-16" />
          <Bone className="h-4 w-10 rounded-full" />
        </div>
        <Bone className="h-3 w-40" />
      </div>
      <div className="flex gap-4 shrink-0">
        <div className="space-y-1 text-right">
          <Bone className="h-3 w-14" />
          <Bone className="h-4 w-20" />
        </div>
        <div className="space-y-1 text-right">
          <Bone className="h-3 w-14" />
          <Bone className="h-4 w-16" />
        </div>
      </div>
    </div>
  )
}
