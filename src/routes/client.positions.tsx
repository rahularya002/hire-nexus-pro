import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Plus, Clock, ArrowRight, SearchX } from "lucide-react";
import { cn, formatSalary } from "@/lib/utils";
import { ClientShell, ClientStatusBadge } from "@/components/client-shell";
import { listPositions, type PositionRow } from "@/lib/positions.functions";
import { listApplications, type ApplicationRow, type ApplicationStage } from "@/lib/candidates.functions";
import { getClientAccountTeam, type ClientAccountMember } from "@/lib/team.functions";
import { CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

const VISIBLE_STEPS = [
  { id: "received",  label: "Received" },
  { id: "shared",    label: "Profiles shared" },
  { id: "review",    label: "Client review" },
  { id: "interview", label: "Interviews" },
  { id: "offer",     label: "Offer / Joined" },
] as const;
type StepId = (typeof VISIBLE_STEPS)[number]["id"];

type Funnel = { shared: number; shortlisted: number; interview: number; offered: number; joined: number };

function funnelFor(apps: ApplicationRow[]): Funnel {
  const f: Funnel = { shared: 0, shortlisted: 0, interview: 0, offered: 0, joined: 0 };
  for (const a of apps) {
    switch (a.stage as ApplicationStage) {
      case "shared_with_client": f.shared++; break;
      case "client_shortlist": f.shortlisted++; f.shared++; break;
      case "interview_scheduled":
      case "rounds": f.interview++; f.shortlisted++; f.shared++; break;
      case "offered": f.offered++; f.interview++; f.shortlisted++; f.shared++; break;
      case "closed": f.joined++; break;
      default: break;
    }
  }
  return f;
}

function currentStepOf(p: PositionRow, f: Funnel): StepId {
  if (p.status === "closed") return "offer";
  if (f.offered > 0 || f.joined > 0) return "offer";
  if (f.interview > 0) return "interview";
  if (f.shortlisted > 0) return "review";
  if (f.shared > 0) return "shared";
  return "received";
}

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export const Route = createFileRoute("/client/positions")({
  component: ClientPositionsRoute,
});

function ClientPositionsRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/client/positions") return <Outlet />;
  return <ClientShell><Page /></ClientShell>;
}

function Page() {
  const [filter, setFilter] = useState<"all" | "active" | "closed">("all");
  const fetchPositions = useServerFn(listPositions);
  const fetchApps = useServerFn(listApplications);
  const fetchTeam = useServerFn(getClientAccountTeam);
  const posQ = useQuery({ queryKey: ["client-positions"], queryFn: () => fetchPositions({ data: {} }) });
  const appQ = useQuery({ queryKey: ["client-applications-all"], queryFn: () => fetchApps({ data: {} }) });
  const teamQ = useQuery({ queryKey: ["client-account-team"], queryFn: () => fetchTeam() });

  const positions = posQ.data ?? [];
  const apps = appQ.data ?? [];
  const team = teamQ.data?.members ?? [];
  const recruiterMap = useMemo(() => new Map(team.map((m) => [m.id, m])), [team]);

  const appsByPosition = useMemo(() => {
    const m = new Map<string, ApplicationRow[]>();
    for (const a of apps) {
      const arr = m.get(a.position_id) ?? [];
      arr.push(a);
      m.set(a.position_id, arr);
    }
    return m;
  }, [apps]);

  const filtered = positions.filter((p) =>
    filter === "all" ? true : filter === "closed" ? p.status === "closed" : p.status !== "closed"
  );
  const active = positions.filter((p) => p.status !== "closed").length;
  const loading = posQ.isLoading || appQ.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Sent to TalentFlow</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">My Requirements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {positions.length} requirement{positions.length === 1 ? "" : "s"} · {active} active · live progress from your recruitment partner
          </p>
        </div>
        <Link to="/client/upload" className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="size-4" /> Upload new JD
        </Link>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-secondary/60 w-fit">
        {(["all", "active", "closed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium capitalize transition",
              filter === f ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {loading && <CardListSkeleton rows={3} />}
        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={SearchX}
            title="No requirements in this view"
            description={
              filter === "closed"
                ? "Closed roles will appear here once interviews are completed."
                : "Switch tabs or upload a new JD to get started."
            }
          />
        )}
        {filtered.map((p) => (
          <RequirementCard
            key={p.id}
            p={p}
            funnel={funnelFor(appsByPosition.get(p.id) ?? [])}
            recruiter={p.assigned_recruiter_id ? recruiterMap.get(p.assigned_recruiter_id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function slaTone(days: number): { label: string; cls: string } {
  if (days <= 5)  return { label: "On track", cls: "bg-success/15 text-success border-success/25" };
  if (days <= 14) return { label: "Watch",    cls: "bg-warning/15 text-warning border-warning/25" };
  return                 { label: "Overdue",  cls: "bg-destructive/15 text-destructive border-destructive/25" };
}

function RequirementCard({ p, funnel, recruiter }: { p: PositionRow; funnel: Funnel; recruiter?: ClientAccountMember }) {
  const days = daysAgo(p.posted_at);
  const step = currentStepOf(p, funnel);
  const stepIndex = VISIBLE_STEPS.findIndex((s) => s.id === step);
  const sla = slaTone(days);
  const stepCount = (id: StepId) => {
    if (id === "shared")    return f.shared;
    if (id === "review")    return f.shortlisted;
    if (id === "interview") return f.interview;
    if (id === "offer")     return f.offered + f.joined;
    return null;
  };
  const f = funnel;

  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-primary/30 transition">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/client/positions/$positionId" params={{ positionId: p.id }} className="font-semibold hover:text-primary">
              {p.title}
            </Link>
            <ClientStatusBadge status={p.status} />
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", sla.cls)}>
              {sla.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{p.location ?? "—"}</span>
            <span>{[p.experience, formatSalary(p.salary)].filter((v) => v && v !== "—").join(" · ") || "—"}</span>
            <span>{p.openings} opening{p.openings > 1 ? "s" : ""}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3" />Sent {days}d ago</span>
            <span>Recruiter · <span className="text-foreground font-medium">{recruiter?.name ?? "Account team"}</span></span>
          </div>
        </div>
        <Link to="/client/positions/$positionId" params={{ positionId: p.id }}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-xs font-medium hover:bg-secondary shrink-0">
          View detail <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Progress bar */}
      <div className="mt-5">
        <div className="relative">
          <div className="absolute left-0 right-0 top-3 h-0.5 bg-border" />
          <div className="absolute left-0 top-3 h-0.5 bg-primary transition-all"
            style={{ width: `${Math.max(0, stepIndex) / (VISIBLE_STEPS.length - 1) * 100}%` }} />
          <div className="relative grid" style={{ gridTemplateColumns: `repeat(${VISIBLE_STEPS.length}, minmax(0, 1fr))` }}>
            {VISIBLE_STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              const count = stepCount(s.id);
              return (
                <div key={s.id} className="flex flex-col items-center text-center">
                  <div className={cn(
                    "size-6 rounded-full grid place-items-center text-[10px] font-semibold border-2 bg-background transition",
                    done ? "border-primary bg-primary text-primary-foreground" :
                    active ? "border-primary text-primary" :
                    "border-border text-muted-foreground"
                  )}>
                    {done ? "✓" : i + 1}
                  </div>
                  <div className={cn("text-[10px] mt-1.5 font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                    {s.label}
                  </div>
                  {count !== null && (
                    <div className="text-[10px] text-muted-foreground tabular-nums">{count}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}