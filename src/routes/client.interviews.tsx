import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Video, MapPin, Users, Check, X, RotateCw, MessageSquare, ArrowRight } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import {
  listInterviews,
  recordInterviewDecision,
  type InterviewDecision,
  INTERVIEW_PROVIDER_LABEL,
  formatInterviewWhen,
  interviewRoundLabel,
  INTERVIEW_CONDUCTOR_LABEL,
  type InterviewRow,
} from "@/lib/interviews.functions";
import { cn } from "@/lib/utils";
import { RescheduleInterviewDialog } from "@/components/reschedule-interview-dialog";
import { Calendar } from "@/components/ui/calendar";

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

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function Page() {
  const [tab, setTab] = useState<Tab>("today");
  const [rescheduleFor, setRescheduleFor] = useState<InterviewRow | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const fetchInterviews = useServerFn(listInterviews);
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["client-interviews"],
    queryFn: () => fetchInterviews({ data: { scope: "all" } }),
  });

  const counts = { today: 0, upcoming: 0, past: 0 } as Record<Tab, number>;
  for (const i of all) { const b = bucketize(i.scheduled_at); if (b) counts[b]++; }
  const tabRows = all.filter((i) => bucketize(i.scheduled_at) === tab);
  const rows = selectedDay
    ? all.filter((i) => i.scheduled_at && sameDay(new Date(i.scheduled_at), selectedDay))
    : tabRows;

  const { interviewDays, nextInterview } = useMemo(() => {
    const now = Date.now();
    const days: Date[] = [];
    let next: InterviewRow | null = null;
    let nextT = Infinity;
    for (const i of all) {
      if (!i.scheduled_at) continue;
      const d = new Date(i.scheduled_at);
      days.push(d);
      const t = d.getTime();
      if (t >= now && t < nextT) { nextT = t; next = i; }
    }
    return { interviewDays: days, nextInterview: next };
  }, [all]);

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

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <div className="rounded-xl border border-border bg-card p-2 w-fit">
          <Calendar
            mode="single"
            selected={selectedDay}
            onSelect={setSelectedDay}
            modifiers={{ hasInterview: interviewDays }}
            modifiersClassNames={{
              hasInterview: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-primary",
            }}
            className="p-2 pointer-events-auto"
          />
          {selectedDay && (
            <button
              onClick={() => setSelectedDay(undefined)}
              className="w-full text-[11px] text-muted-foreground hover:text-foreground py-1.5"
            >
              Clear date filter
            </button>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Next interview</div>
          {nextInterview ? (
            <>
              <div className="mt-2 text-2xl font-semibold tracking-tight">
                {formatInterviewWhen(nextInterview.scheduled_at)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {nextInterview.candidate?.name ?? "Unknown"} · {nextInterview.position?.title ?? "—"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                R{nextInterview.round_index} · {interviewRoundLabel(nextInterview)} · {INTERVIEW_PROVIDER_LABEL[nextInterview.provider]}
              </div>
              <div className="mt-auto pt-4 flex gap-2">
                <a
                  href={nextInterview.meeting_link ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 inline-flex items-center gap-1",
                    !nextInterview.meeting_link && "opacity-50 pointer-events-none",
                  )}
                >
                  <Video className="size-3.5" /> Join
                </a>
                <Link
                  to="/client/positions/$positionId"
                  params={{ positionId: nextInterview.position_id }}
                  className="h-9 px-3 rounded-md border border-border text-xs font-medium hover:bg-secondary inline-flex items-center gap-1"
                >
                  View role <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">No upcoming interviews scheduled.</div>
          )}
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-secondary/60 w-fit">
        {([
          { id: "today",    label: `Today (${counts.today})` },
          { id: "upcoming", label: `Upcoming (${counts.upcoming})` },
          { id: "past",     label: `Past (${counts.past})` },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setSelectedDay(undefined); }}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition",
              tab === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
        {selectedDay && (
          <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary inline-flex items-center gap-1">
            {selectedDay.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
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
              <div className="text-[11px] text-muted-foreground mt-0.5">
                R{r.round_index} · {interviewRoundLabel(r)} · Conducted by {INTERVIEW_CONDUCTOR_LABEL[r.conducted_by]}
              </div>
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
                <PastDecision row={r} />
              ) : (
                <>
                  <button
                    onClick={() => setRescheduleFor(r)}
                    className="h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-secondary"
                  >
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
      <RescheduleInterviewDialog
        interview={rescheduleFor}
        onClose={() => setRescheduleFor(null)}
        invalidateKeys={[["client-interviews"], ["staff-interviews"], ["interviews", "today"]]}
      />
    </div>
  );
}

function PastDecision({ row }: { row: InterviewRow }) {
  const qc = useQueryClient();
  const decide = useServerFn(recordInterviewDecision);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const stage = row.application?.stage ?? null;

  const mutation = useMutation({
    mutationFn: (decision: InterviewDecision) =>
      decide({ data: { applicationId: row.application_id, decision, note: note.trim() || undefined } }),
    onSuccess: () => {
      setNote("");
      setNoteOpen(false);
      qc.invalidateQueries({ queryKey: ["client-interviews"] });
      qc.invalidateQueries({ queryKey: ["staff-interviews"] });
      qc.invalidateQueries({ queryKey: ["client-pipeline"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  if (stage === "offered" || stage === "closed") {
    return (
      <span className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-success/10 text-success border border-success/20 text-xs font-medium">
        <Check className="size-3.5" /> Selected
      </span>
    );
  }
  if (stage === "client_rejected") {
    return (
      <span className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-destructive/10 text-destructive border border-destructive/25 text-xs font-medium">
        <X className="size-3.5" /> Rejected
      </span>
    );
  }

  const disabled = mutation.isPending;

  return (
    <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
      <div className="flex flex-wrap items-center gap-1.5 justify-end">
        <button
          disabled={disabled}
          onClick={() => mutation.mutate("select")}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 inline-flex items-center gap-1 disabled:opacity-50"
        >
          <Check className="size-3.5" /> Select
        </button>
        <button
          disabled={disabled}
          onClick={() => mutation.mutate("next_round")}
          className="h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-secondary inline-flex items-center gap-1 disabled:opacity-50"
        >
          <RotateCw className="size-3.5" /> Next round
        </button>
        <button
          disabled={disabled}
          onClick={() => mutation.mutate("reject")}
          className="h-8 px-3 rounded-md border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 inline-flex items-center gap-1 disabled:opacity-50"
        >
          <X className="size-3.5" /> Reject
        </button>
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          className="h-8 px-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <MessageSquare className="size-3.5" /> {noteOpen ? "Hide note" : "Add note"}
        </button>
      </div>
      {noteOpen && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Feedback for the recruiter (optional)…"
          rows={2}
          className="w-full sm:w-80 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs resize-y"
        />
      )}
      {mutation.isError && (
        <div className="text-[11px] text-destructive">{(mutation.error as Error).message}</div>
      )}
    </div>
  );
}