import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Activity as ActivityIcon, Phone, Star, Share2, CalendarClock,
  CheckCircle2, Award, FileText, MessageSquare, UserPlus,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  listActivities,
  formatRelative,
  type ActivityKind,
  type ActivityRow,
} from "@/lib/activities.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/activity")({
  component: () => <AppShell><Page /></AppShell>,
});

const KIND_META: Record<ActivityKind, { icon: typeof Phone; tone: string; label: string }> = {
  call:                 { icon: Phone,         tone: "bg-info/15 text-info",         label: "Call" },
  shortlist:            { icon: Star,          tone: "bg-purple/15 text-purple",     label: "Shortlist" },
  share:                { icon: Share2,        tone: "bg-primary/15 text-primary",   label: "Shared" },
  interview_scheduled:  { icon: CalendarClock, tone: "bg-warning/15 text-warning",   label: "Interview" },
  interview_completed:  { icon: CheckCircle2,  tone: "bg-info/15 text-info",         label: "Interview done" },
  offer:                { icon: Award,         tone: "bg-success/15 text-success",   label: "Offer" },
  closure:              { icon: CheckCircle2,  tone: "bg-success/20 text-success",   label: "Closure" },
  note:                 { icon: FileText,      tone: "bg-secondary text-foreground", label: "Note" },
  submission:           { icon: UserPlus,      tone: "bg-info/15 text-info",         label: "Submission" },
  document:             { icon: FileText,      tone: "bg-warning/15 text-warning",   label: "Document" },
  message:              { icon: MessageSquare, tone: "bg-secondary text-foreground", label: "Message" },
  stage_change:         { icon: CheckCircle2,  tone: "bg-primary/15 text-primary",   label: "Stage change" },
};

function Page() {
  const fetchActivities = useServerFn(listActivities);
  const { data: events = [], isLoading } = useQuery<ActivityRow[]>({
    queryKey: ["activities"],
    queryFn: () => fetchActivities({ data: { limit: 200 } }),
  });

  const [kindFilter, setKindFilter] = useState<ActivityKind | "all">("all");
  const [query, setQuery] = useState("");
  const [days, setDays] = useState<number>(30);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      if (new Date(e.occurred_at).getTime() < cutoff) return false;
      if (q && !`${e.title} ${e.detail ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, kindFilter, query, days]);

  const summary = useMemo(() => {
    const cut = Date.now() - 24 * 60 * 60 * 1000;
    const recent = events.filter((e) => new Date(e.occurred_at).getTime() >= cut);
    const count = (kinds: ActivityKind[]) => recent.filter((e) => kinds.includes(e.kind)).length;
    return {
      shares: count(["share"]),
      calls: count(["call"]),
      interviews: count(["interview_scheduled", "interview_completed"]),
      offers: count(["offer"]),
      closures: count(["closure"]),
    };
  }, [events]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Transparency</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
            <ActivityIcon className="size-5 text-primary" /> Audit log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every recruiter action — recorded automatically as the team operates.
          </p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryTile label="Shares (24h)"      value={summary.shares}      icon={Share2}        tone="text-primary" />
        <SummaryTile label="Calls (24h)"       value={summary.calls}       icon={Phone}         tone="text-info" />
        <SummaryTile label="Interviews (24h)"  value={summary.interviews}  icon={CalendarClock} tone="text-warning" />
        <SummaryTile label="Offers (24h)"      value={summary.offers}      icon={Award}         tone="text-success" />
        <SummaryTile label="Closures (24h)"    value={summary.closures}    icon={CheckCircle2}  tone="text-success" />
      </div>

      {/* Activity feed */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
          <h2 className="font-semibold tracking-tight text-sm mr-2">All recruiter activity</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title / detail"
            className="h-8 px-2 text-xs rounded-md border border-input bg-secondary/40 outline-none focus:ring-1 focus:ring-ring w-56"
          />
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as any)}
            className="h-8 px-2 text-xs rounded-md border border-input bg-secondary/40 outline-none"
          >
            <option value="all">All kinds</option>
            {Object.entries(KIND_META).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
          </select>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-8 px-2 text-xs rounded-md border border-input bg-secondary/40 outline-none"
          >
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7d</option>
            <option value={30}>Last 30d</option>
            <option value={365}>Last year</option>
          </select>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} of {events.length}
          </span>
        </div>
        <div className="divide-y divide-border">
          {isLoading && (
            <div className="p-10 text-sm text-muted-foreground text-center">Loading…</div>
          )}
          {filtered.length === 0 && (
            !isLoading && <div className="p-10 text-sm text-muted-foreground text-center">No activity matches the current filters.</div>
          )}
          {filtered.map((e) => {
            const meta = KIND_META[e.kind];
            const Icon = meta.icon;
            return (
              <div key={e.id} className="flex items-start gap-3 p-4 hover:bg-secondary/30 transition">
                <div className={cn("size-9 rounded-full grid place-items-center shrink-0", meta.tone)}>
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{e.title}</div>
                  {e.detail && <div className="text-xs text-muted-foreground truncate">{e.detail}</div>}
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatRelative(e.occurred_at)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Phone; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={cn("size-3.5", tone)} />
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}