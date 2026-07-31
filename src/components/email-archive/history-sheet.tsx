import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/empty-state";
import { listImportRuns } from "@/lib/email-import.functions";
import { fmtDate, relTime } from "./shared";

const STATUS_TONE: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/25",
  running: "bg-primary/10 text-primary border-primary/25",
  paused: "bg-warning/10 text-warning border-warning/30",
  cancelled: "bg-secondary text-muted-foreground border-border",
  failed: "bg-destructive/10 text-destructive border-destructive/25",
};

export function HistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fetchRuns = useServerFn(listImportRuns);
  const runs = useQuery({ queryKey: ["email-import-runs"], queryFn: () => fetchRuns(), enabled: open });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Recovery history</SheetTitle>
          <SheetDescription>Every recovery run on this mailbox, newest first.</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-2">
          {runs.isLoading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading history…
            </div>
          ) : (runs.data ?? []).length === 0 ? (
            <EmptyState
              icon={History}
              title="No recovery runs yet"
              description="Once you recover your recruitment memory, every run shows up here with what it found."
            />
          ) : (
            (runs.data ?? []).map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${
                      STATUS_TONE[r.status] ?? STATUS_TONE.cancelled
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{relTime(r.created_at)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.date_from
                    ? `${fmtDate(r.date_from)} → ${r.date_to ? fmtDate(r.date_to) : "today"}`
                    : "Entire mailbox"}{" "}
                  · {r.google_email ?? "—"}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">{r.emails_scanned}</span> scanned
                  </span>
                  <span>
                    <span className="font-medium text-foreground">{r.people_found}</span> recovered
                  </span>
                  <span>
                    <span className="font-medium text-foreground">{r.needs_review}</span> to review
                  </span>
                  {!!r.failures && <span>{r.failures} unreadable</span>}
                  {!!r.duplicates_merged && <span>{r.duplicates_merged} duplicates skipped</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}