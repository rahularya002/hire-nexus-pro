import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Video, MapPin, Users, Check, X, ArrowRight, Calendar as CalendarIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getMyGoogleConnection } from "@/lib/google-calendar.functions";
import {
  listInterviews,
  INTERVIEW_PROVIDER_LABEL,
  formatInterviewWhen,
  interviewRoundLabel,
  INTERVIEW_CONDUCTOR_LABEL,
  type InterviewRow,
} from "@/lib/interviews.functions";
import { cn } from "@/lib/utils";
import { RescheduleInterviewDialog } from "@/components/reschedule-interview-dialog";
import { Calendar } from "@/components/ui/calendar";

export const Route = createFileRoute("/interviews")({
  component: () => <AppShell><Page /></AppShell>,
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
  const fetchGoogle = useServerFn(getMyGoogleConnection);
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["staff-interviews"],
    queryFn: () => fetchInterviews({ data: { scope: "all" } }),
  });
  const { data: google } = useQuery({
    queryKey: ["google-connection"],
    queryFn: () => fetchGoogle(),
  });
  const googleConnected = !!google?.connected;

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

  const JoinCell = ({ r, size = "sm" }: { r: InterviewRow; size?: "sm" | "md" }) => {
    const h = size === "md" ? "h-9" : "h-8";
    if (r.provider === "on_site") {
      return (
        <span className={cn(h, "px-3 rounded-md border border-border text-xs font-medium inline-flex items-center gap-1 text-muted-foreground")}>
          <MapPin className="size-3.5" /> {r.location?.trim() || "On-site (location TBD)"}
        </span>
      );
    }
    if (r.provider === "phone") {
      return (
        <span className={cn(h, "px-3 rounded-md border border-border text-xs font-medium inline-flex items-center gap-1 text-muted-foreground")}>
          Phone call
        </span>
      );
    }
    if (r.meeting_link) {
      return (
        <a href={r.meeting_link} target="_blank" rel="noreferrer"
           className={cn(h, "px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 inline-flex items-center gap-1")}>
          <Video className="size-3.5" /> Join
        </a>
      );
    }
    return (
      <span className={cn(h, "px-3 rounded-md border border-border bg-secondary/40 text-muted-foreground text-xs font-medium inline-flex items-center gap-1")}
            title={googleConnected ? "Meet link will appear once the event syncs." : "No meeting link yet — reschedule to add one, or connect Google Calendar in Settings to auto-generate."}>
          <CalendarIcon className="size-3.5" /> Meeting link pending
        </span>
    );
  };

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
                <JoinCell r={nextInterview} size="md" />
                <Link
                  to="/positions/$positionId"
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
              <Link to="/positions/$positionId" params={{ positionId: r.position_id }}
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
                <PastStatus row={r} />
              ) : (
                <>
                  <button
                    onClick={() => setRescheduleFor(r)}
                    className="h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-secondary"
                  >
                    Reschedule
                  </button>
                  <JoinCell r={r} />
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
        invalidateKeys={[["staff-interviews"], ["client-interviews"], ["interviews", "today"]]}
      />
    </div>
  );
}

function PastStatus({ row }: { row: InterviewRow }) {
  const stage = row.application?.stage ?? null;
  if (stage === "closed") {
    return (
      <span className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-success/15 text-success border border-success/25 text-xs font-medium">
        <Check className="size-3.5" /> Joined
      </span>
    );
  }
  if (stage === "offered") {
    return (
      <span className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-success/10 text-success border border-success/20 text-xs font-medium">
        <Check className="size-3.5" /> Selected — awaiting join
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
  return (
    <span className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border bg-secondary/40 text-muted-foreground text-xs font-medium">
      Awaiting client decision
    </span>
  );
}

function statusTone(s: InterviewStatus) {
  if (s === "confirmed") return "bg-success/15 text-success border-success/25";
  if (s === "completed") return "bg-success/20 text-success border-success/30";
  if (s === "pending_confirmation") return "bg-warning/15 text-warning border-warning/25";
  if (s === "reschedule_requested") return "bg-info/15 text-info border-info/25";
  return "bg-destructive/10 text-destructive border-destructive/25";
}

function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
}

function Page() {
  const fetchInterviews = useServerFn(listInterviews);
  const fetchGoogle = useServerFn(getMyGoogleConnection);
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["staff-interviews"],
    queryFn: () => fetchInterviews({ data: { scope: "all" } }),
  });
  const { data: google } = useQuery({
    queryKey: ["google-connection"],
    queryFn: () => fetchGoogle(),
  });
  const googleConnected = !!google?.connected;

  const startToday = new Date(); startToday.setHours(0,0,0,0);
  const endToday = new Date(); endToday.setHours(23,59,59,999);
  const todays = all.filter((i) => {
    if (!i.scheduled_at) return false;
    const t = new Date(i.scheduled_at).getTime();
    return t >= startToday.getTime() && t <= endToday.getTime();
  });

  // Group all interviews by application_id => process
  const processMap = new Map<string, InterviewRow[]>();
  for (const i of all) {
    const list = processMap.get(i.application_id) ?? [];
    list.push(i);
    processMap.set(i.application_id, list);
  }
  const processes = Array.from(processMap.entries()).map(([appId, rounds]) => ({
    id: appId,
    rounds: rounds.sort((a, b) => a.round_index - b.round_index),
    candidate: rounds[0]?.candidate?.name ?? "Unknown",
    candidateInitials: initialsOf(rounds[0]?.candidate?.name),
    position: rounds[0]?.position?.title ?? "—",
    client: rounds[0]?.position?.client?.name ?? "—",
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Orchestration</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" /> Interviews
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? "\u00A0" : "Multi-round pipeline · slot negotiation · provider integration · reminders."}
        </p>
      </div>

      {/* Today's quick view */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold tracking-tight text-sm">Today's interviews</h2>
          <span className="text-xs text-muted-foreground">{todays.length} scheduled</span>
        </div>
        <TodayByCompany rows={todays} googleConnected={googleConnected} />
      </div>

      {/* Multi-round processes */}
      <div className="space-y-2">
        <h2 className="font-semibold tracking-tight text-sm">Active interview processes</h2>
        <p className="text-xs text-muted-foreground">Each candidate progresses through their own dynamic interview pipeline.</p>
      </div>

      {processes.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-12 text-center text-sm text-muted-foreground">
          No interview processes yet. Schedule interviews from a candidate's application.
        </div>
      )}

      <div className="space-y-4">
        {processes.map((proc) => {
          const completed = proc.rounds.filter((r) => r.status === "completed").length;
          return (
            <Link
              key={proc.id}
              to="/interviews/$processId"
              params={{ processId: proc.id }}
              className="block rounded-xl border border-border bg-card hover:border-primary/40 transition group"
            >
              <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
                <div className="size-9 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold shrink-0">
                  {proc.candidateInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{proc.candidate}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{proc.position} · {proc.client}</div>
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  Round {completed + 1} of {proc.rounds.length}
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition" />
              </div>

              {/* Visual round pipeline */}
              <div className="p-4">
                <div className="flex items-stretch gap-1.5">
                  {proc.rounds.map((r, i) => {
                    const isLast = i === proc.rounds.length - 1;
                    return (
                      <div key={r.id} className="flex-1 min-w-0 relative">
                        <div className={cn(
                          "rounded-md border px-2.5 py-2 text-left",
                          statusTone(r.status)
                        )}>
                          <div className="text-[9px] uppercase tracking-wider opacity-80">R{r.round_index}</div>
                          <div className="text-xs font-semibold truncate">{interviewRoundLabel(r)}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{INTERVIEW_CONDUCTOR_LABEL[r.conducted_by]}</div>
                          <div className="text-[10px] opacity-80 truncate mt-0.5">{formatInterviewWhen(r.scheduled_at)}</div>
                        </div>
                        {!isLast && (
                          <div className="hidden sm:block absolute top-1/2 -right-1 -translate-y-1/2 w-1 h-px bg-border" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TodayByCompany({ rows, googleConnected }: { rows: InterviewRow[]; googleConnected: boolean }) {
  const groups = rows.reduce<Record<string, InterviewRow[]>>((acc, i) => {
    const key = i.position?.client?.name ?? "Unknown client";
    (acc[key] ||= []).push(i);
    return acc;
  }, {});
  const entries = Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);

  if (entries.length === 0) {
    return <div className="p-6 text-sm text-muted-foreground text-center">No interviews today.</div>;
  }

  return (
    <div className="divide-y divide-border">
      {entries.map(([client, list]) => (
        <div key={client}>
          <div className="px-4 py-2.5 bg-secondary/40 flex items-center gap-2">
            <Building2 className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold tracking-tight">{client}</span>
            <span className="text-[11px] text-muted-foreground">· {list.length} {list.length === 1 ? "interview" : "interviews"}</span>
          </div>
          <div className="divide-y divide-border/60">
            {list.map((i) => (
              <div key={i.id} className="flex items-center gap-4 px-4 py-3 hover:bg-secondary/30 transition">
                <div className="text-sm font-semibold text-primary tabular-nums w-16">
                  {i.scheduled_at ? new Date(i.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{i.candidate?.name ?? "Unknown"} · <span className="text-muted-foreground font-normal">{i.position?.title ?? "—"}</span></div>
                  <div className="text-[11px] text-muted-foreground truncate">R{i.round_index} · {interviewRoundLabel(i)} · {INTERVIEW_CONDUCTOR_LABEL[i.conducted_by]} · {INTERVIEW_STATUS_LABEL[i.status]}</div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-info/10 text-info inline-flex items-center gap-1">
                  <Video className="size-3" />{INTERVIEW_PROVIDER_LABEL[i.provider]}
                </span>
                {i.provider === "on_site" ? (
                  <span className="text-xs font-medium h-8 px-3 rounded-md border border-border inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3" /> {i.location?.trim() || "On-site"}
                  </span>
                ) : i.provider === "phone" ? (
                  <span className="text-xs font-medium h-8 px-3 rounded-md border border-border inline-flex items-center text-muted-foreground">Phone</span>
                ) : i.meeting_link ? (
                  <a href={i.meeting_link} target="_blank" rel="noreferrer"
                     className="text-xs font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1">
                    <Video className="size-3" /> Join
                  </a>
                ) : (
                  <span
                    className="text-xs font-medium h-8 px-3 rounded-md border border-border bg-secondary/40 text-muted-foreground inline-flex items-center gap-1"
                    title={googleConnected ? "Meet link will appear once the event syncs." : "No link yet — add one on reschedule, or connect Google in Settings to auto-generate."}
                  >
                    <CalendarIcon className="size-3" /> Link pending
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}