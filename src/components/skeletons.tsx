import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Inline skeleton sized for replacing a one-line label/subtitle text. */
export function TextSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-3.5 w-40 inline-block align-middle", className)} />;
}

/** Generic vertical list rows (avatar + 2 lines). */
export function ListRowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4">
          <Skeleton className="size-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Card grid for positions / requirements. */
export function CardListSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Member / team card skeleton (avatar + meta + footer). */
export function MemberCardGridSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start gap-4">
            <Skeleton className="size-12 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Kanban column placeholder cards. */
export function KanbanCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Activity / message stream rows. */
export function ActivityStreamSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-4">
          <Skeleton className="size-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

/** Table rows that span full table width. */
export function TableRowsSkeleton({
  rows = 5,
  cols = 5,
}: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4 w-full max-w-[160px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Chat thread message bubble skeletons (alternating sides). */
export function ChatMessagesSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => {
        const mine = i % 2 === 1;
        return (
          <div key={i} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div className={cn("space-y-2", mine ? "items-end" : "items-start")}>
              <Skeleton className={cn("h-3 w-24", mine && "ml-auto")} />
              <Skeleton className={cn("rounded-2xl", mine ? "h-10 w-56" : "h-14 w-72")} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** KPI tile placeholder, sized to match a typical metric card. */
export function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <Skeleton className="size-10 rounded-lg" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}