import { Skeleton } from "@/components/ui/skeleton";

// Generic dashboard page skeleton: icon + title row, stat cards, toolbar, table with icon-only actions.
export function PageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-7 w-44" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <Skeleton className="h-9 w-full max-w-xs" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20 hidden sm:block" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-5 rounded-md" />
                <Skeleton className="h-5 w-5 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
