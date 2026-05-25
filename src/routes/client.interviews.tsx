import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Video, MapPin, Users } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import {
  listInterviews,
  INTERVIEW_PROVIDER_LABEL,
  formatInterviewWhen,
} from "@/lib/interviews.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/interviews")({
  component: () => <ClientShell><Page /></ClientShell>,
});

type Tab = "today" | "upcoming" | "past";

function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
}

function bucketize(scheduledAt: string | null): Tab | null {
  if (!scheduledAt) return null;
  const d = new Date(scheduledAt).getTime();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  if (d < start.getTime()) return "past";
  if (d > end.getTime()) return "upcoming";
  return "today";
}

function Page() {
  const [tab, setTab] = useState<Tab>("today");
  const fetchInterviews = useServerFn(listInterviews);
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["client-interviews"],
    queryFn: () => fetchInterviews({ data: { scope: "all" } }),
  });

  const counts = { today: 0, upcoming: 0, past: 0 } as Record<Tab, number>;
  for (const i of all) { const b = bucketize(i.scheduled_at); if (b) counts[b]++; }
  const rows = all.filter((i) => bucketize(i.scheduled_at) === tab);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Calendar</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" /> Interviews
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? "\u00A0" : "All scheduled candidate interviews across your requirements."}
        </p>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-secondary/60 w-fit">
        {([
          { id: "today",    label: `Today (${counts.today})` },
          { id: "upcoming", label: `Upcoming (${counts.upcoming})` },
          { id: "past",     label: `Past (${counts.past})` },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition",
              tab === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {rows.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">No interviews in this view.</div>
        )}
        {rows.map((r) => {
          const when = formatInterviewWhen(r.scheduled_at);
          const [datePart, timePart] = when.includes(" · ") ? when.split(" · ") : [when, ""];
          const mode = INTERVIEW_PROVIDER_LABEL[r.provider];
          const isOnSite = r.provider === "on_site";
          return (
          <div key={r.id} className="p-4 flex items-center gap-4 hover:bg-secondary/40 transition flex-wrap">
            <div className="text-center shrink-0 w-16">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{datePart}</div>
              <div className="text-base font-semibold text-primary tabular-nums">{timePart || "—"}</div>
            </div>
            <div className="size-10 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold shrink-0">
              {initialsOf(r.candidate?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{r.candidate?.name ?? "Unknown"}</div>
              <Link to="/client/positions/$positionId" params={{ positionId: r.position_id }}
                className="text-xs text-muted-foreground hover:text-primary truncate block">
                {r.position?.title ?? "—"}
              </Link>
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-1">
                <span className="inline-flex items-center gap-1"><Users className="size-3" />{r.interviewer ?? "Panel TBD"}</span>
                <span className="inline-flex items-center gap-1">
                  {isOnSite ? <MapPin className="size-3" /> : <Video className="size-3" />}
                  {mode}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {tab === "past" ? (
                <button className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                  Submit feedback
                </button>
              ) : (
                <>
                  <button className="h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-secondary">
                    Reschedule
                  </button>
                  <a href={r.meeting_link ?? "#"} target="_blank" rel="noreferrer"
                     className={cn("h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 inline-flex items-center gap-1", !r.meeting_link && "opacity-50 pointer-events-none")}>
                    <Video className="size-3.5" /> Join
                  </a>
                </>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}