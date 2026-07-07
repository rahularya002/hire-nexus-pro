import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Video, ArrowUpRight, Building2, MapPin, Link2Off, Calendar as CalendarIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import { getMyGoogleConnection } from "@/lib/google-calendar.functions";
import {
  listInterviews,
  INTERVIEW_STATUS_LABEL,
  INTERVIEW_PROVIDER_LABEL,
  formatInterviewWhen,
  interviewRoundLabel,
  INTERVIEW_CONDUCTOR_LABEL,
  type InterviewRow,
  type InterviewStatus,
} from "@/lib/interviews.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/interviews")({
  component: () => <AppShell><Page /></AppShell>,
});

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

function TodayByCompany({ rows }: { rows: InterviewRow[] }) {
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
                <a href={i.meeting_link ?? "#"} target="_blank" rel="noreferrer"
                   className={cn("text-xs font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center", !i.meeting_link && "opacity-50 pointer-events-none")}>
                  Join
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}