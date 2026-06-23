import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ActivityStreamSkeleton } from "@/components/skeletons";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Activity as ActivityIcon, UserPlus, Star, Calendar, FileText,
  MessageSquare, CheckCircle2, Phone, Share2, CalendarClock, Award,
  Search, Filter, Briefcase,
} from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import {
  listActivities,
  formatRelative,
  type ActivityKind,
  type ActivityRow,
} from "@/lib/activities.functions";
import { listPositions } from "@/lib/positions.functions";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/client/activity")({
  component: () => <ClientShell><Page /></ClientShell>,
});

const META: Record<ActivityKind, { icon: typeof UserPlus; tone: string; ring: string; label: string }> = {
  submission:           { icon: UserPlus,      tone: "bg-info/15 text-info",            ring: "ring-info/30",     label: "Candidate" },
  shortlist:            { icon: Star,          tone: "bg-purple/15 text-purple",        ring: "ring-purple/30",   label: "Shortlist" },
  share:                { icon: Share2,        tone: "bg-primary/15 text-primary",      ring: "ring-primary/30",  label: "Shared" },
  interview_scheduled:  { icon: CalendarClock, tone: "bg-warning/15 text-warning",      ring: "ring-warning/30",  label: "Interview" },
  interview_completed:  { icon: Calendar,      tone: "bg-primary/15 text-primary",      ring: "ring-primary/30",  label: "Interview" },
  offer:                { icon: Award,         tone: "bg-success/15 text-success",      ring: "ring-success/30",  label: "Offer" },
  closure:              { icon: CheckCircle2,  tone: "bg-success/15 text-success",      ring: "ring-success/30",  label: "Closed" },
  document:             { icon: FileText,      tone: "bg-warning/15 text-warning",      ring: "ring-warning/30",  label: "Document" },
  message:              { icon: MessageSquare, tone: "bg-secondary text-foreground",    ring: "ring-border",      label: "Message" },
  note:                 { icon: FileText,      tone: "bg-secondary text-foreground",    ring: "ring-border",      label: "Note" },
  call:                 { icon: Phone,         tone: "bg-info/15 text-info",            ring: "ring-info/30",     label: "Call" },
  stage_change:         { icon: CheckCircle2,  tone: "bg-primary/15 text-primary",      ring: "ring-primary/30",  label: "Pipeline" },
};

const FILTERS: { id: "all" | ActivityKind; label: string }[] = [
  { id: "all",                 label: "All" },
  { id: "submission",          label: "Candidates" },
  { id: "shortlist",           label: "Shortlists" },
  { id: "interview_scheduled", label: "Interviews" },
  { id: "offer",               label: "Offers" },
  { id: "closure",             label: "Closures" },
  { id: "message",             label: "Messages" },
  { id: "document",            label: "Documents" },
];

function dayKey(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  if (dd.getTime() === today.getTime()) return "Today";
  if (dd.getTime() === yest.getTime()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function Page() {
  const { clientContext } = useAuth();
  const clientId = clientContext?.clientId ?? null;

  const fetchActivities = useServerFn(listActivities);
  const fetchPositions = useServerFn(listPositions);

  const { data: positions = [] } = useQuery({
    queryKey: ["client-activity-positions", clientId],
    queryFn: () => fetchPositions({ data: { clientId: clientId! } }),
    enabled: !!clientId,
  });

  const [positionId, setPositionId] = useState<string>("all");
  const [filter, setFilter] = useState<"all" | ActivityKind>("all");
  const [q, setQ] = useState("");

  const { data: events = [], isLoading } = useQuery<ActivityRow[]>({
    queryKey: ["client-activities", clientId, positionId],
    queryFn: () =>
      fetchActivities({
        data: {
          limit: 200,
          clientId: clientId ?? undefined,
          positionId: positionId === "all" ? undefined : positionId,
        },
      }),
    enabled: !!clientId,
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return events.filter((e) => {
      if (filter !== "all" && e.kind !== filter) return false;
      if (!term) return true;
      return (
        e.title.toLowerCase().includes(term) ||
        (e.detail ?? "").toLowerCase().includes(term)
      );
    });
  }, [events, filter, q]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    for (const e of filtered) {
      const k = dayKey(e.occurred_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const total = events.length;
  const counts = useMemo(() => {
    const c: Partial<Record<ActivityKind, number>> = {};
    for (const e of events) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [events]);


  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-purple/5 to-info/5 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Account stream</div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
              <span className="size-9 rounded-xl grid place-items-center bg-primary/10 text-primary">
                <ActivityIcon className="size-4" />
              </span>
              Activity
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              Every update from your recruitment partner — submissions, interviews, offers and more.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Total"      value={total} />
            <Stat label="Interviews" value={(counts.interview_scheduled ?? 0) + (counts.interview_completed ?? 0)} tone="text-warning" />
            <Stat label="Offers"     value={(counts.offer ?? 0) + (counts.closure ?? 0)} tone="text-success" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search activity…"
            className="w-full h-10 rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <Filter className="size-3.5 text-muted-foreground shrink-0" />
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const count = f.id === "all" ? total : counts[f.id] ?? 0;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
              >
                {f.label}
                <span className={cn(
                  "tabular-nums text-[10px] px-1.5 py-0.5 rounded-full",
                  active ? "bg-primary-foreground/15" : "bg-secondary",
                )}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stream */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          <ActivityStreamSkeleton rows={6} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <div className="size-12 rounded-full bg-secondary mx-auto grid place-items-center mb-3">
            <ActivityIcon className="size-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">{events.length === 0 ? "No activity yet" : "Nothing matches your filters"}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {events.length === 0 ? "Updates from your recruiter will appear here." : "Try clearing the search or picking a different category."}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([day, items]) => (
            <section key={day}>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{day}</div>
                <div className="h-px flex-1 bg-border" />
                <div className="text-[11px] text-muted-foreground tabular-nums">{items.length} event{items.length > 1 ? "s" : ""}</div>
              </div>
              <ol className="relative pl-6">
                <div className="absolute left-[14px] top-1 bottom-1 w-px bg-border" aria-hidden />
                {items.map((e) => {
                  const meta = META[e.kind];
                  const Icon = meta.icon;
                  return (
                    <li key={e.id} className="relative pb-4 last:pb-0">
                      <span
                        className={cn(
                          "absolute -left-[10px] top-1 size-6 rounded-full grid place-items-center ring-4 ring-background",
                          meta.tone,
                        )}
                      >
                        <Icon className="size-3" />
                      </span>
                      <div className="ml-3 rounded-xl border border-border bg-card p-4 hover:bg-secondary/40 transition">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn("text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded", meta.tone)}>
                                {meta.label}
                              </span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">{timeOf(e.occurred_at)}</span>
                            </div>
                            <div className="text-sm font-medium mt-1.5">{e.title}</div>
                            {e.detail && (
                              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{e.detail}</div>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                            {formatRelative(e.occurred_at)}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-card/70 border border-border">
      <div className={cn("text-xl font-semibold tabular-nums", tone ?? "text-foreground")}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}