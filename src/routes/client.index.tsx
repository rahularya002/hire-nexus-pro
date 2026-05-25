import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Upload, Send, Star, CalendarCheck, Award, XCircle, ArrowUpRight, MapPin } from "lucide-react";
import { ClientShell, ClientStatusBadge } from "@/components/client-shell";
import { listPositions, type PositionRow } from "@/lib/positions.functions";
import { listApplications, type ApplicationRow } from "@/lib/candidates.functions";
import { useAuth } from "@/lib/auth/auth-context";
import { CardListSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/client/")({
  component: () => <ClientShell><Dashboard /></ClientShell>,
});

type Funnel = { shared: number; shortlisted: number; interview: number; offered: number; rejected: number };

function funnelFor(apps: ApplicationRow[]): Funnel {
  const f: Funnel = { shared: 0, shortlisted: 0, interview: 0, offered: 0, rejected: 0 };
  for (const a of apps) {
    switch (a.stage) {
      case "shared_with_client": f.shared++; break;
      case "client_shortlist": f.shortlisted++; f.shared++; break;
      case "interview_scheduled":
      case "rounds": f.interview++; f.shortlisted++; f.shared++; break;
      case "offered": f.offered++; f.interview++; f.shortlisted++; f.shared++; break;
      case "closed": f.rejected++; break;
      default: break;
    }
  }
  return f;
}

function Dashboard() {
  const { profile } = useAuth();
  const fetchPositions = useServerFn(listPositions);
  const fetchApps = useServerFn(listApplications);
  const posQ = useQuery({ queryKey: ["client-positions"], queryFn: () => fetchPositions({ data: {} }) });
  const appQ = useQuery({ queryKey: ["client-applications-all"], queryFn: () => fetchApps({ data: {} }) });

  const positions = posQ.data ?? [];
  const apps = appQ.data ?? [];
  const open = positions.filter((p) => p.status !== "closed").length;
  const appsByPosition = new Map<string, ApplicationRow[]>();
  for (const a of apps) {
    const list = appsByPosition.get(a.position_id) ?? [];
    list.push(a);
    appsByPosition.set(a.position_id, list);
  }
  const totals = funnelFor(apps);
  const companyName = profile?.company_name || profile?.full_name || "there";
  const loading = posQ.isLoading || appQ.isLoading;

  const kpis = [
    { label: "Profiles shared", value: totals.shared,      icon: Send,         tone: "from-primary/15 to-primary/5 text-primary" },
    { label: "Shortlisted",     value: totals.shortlisted, icon: Star,         tone: "from-purple/15 to-purple/5 text-purple" },
    { label: "Interviewed",     value: totals.interview,   icon: CalendarCheck,tone: "from-info/15 to-info/5 text-info" },
    { label: "Offered",         value: totals.offered,     icon: Award,        tone: "from-success/15 to-success/5 text-success" },
    { label: "Rejected",        value: totals.rejected,    icon: XCircle,      tone: "from-destructive/15 to-destructive/5 text-destructive" },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border p-6 md:p-8 bg-gradient-to-br from-primary/10 via-purple/5 to-card">
        <div className="absolute -right-20 -top-20 size-64 rounded-full opacity-30 blur-3xl" style={{ background: "oklch(0.62 0.20 295)" }} />
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your hiring at a glance</div>
            <h1 className="text-3xl font-semibold tracking-tight mt-2">Welcome back, {companyName}</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              You have <span className="font-semibold text-foreground">{open} active mandates</span> and <span className="font-semibold text-foreground">{totals.shared} profiles</span> shared with you so far.
            </p>
          </div>
          <Link to="/client/upload"
            className="group inline-flex items-center gap-3 h-14 pl-5 pr-6 rounded-xl bg-foreground text-background font-medium shadow-xl hover:shadow-2xl transition">
            <div className="size-9 rounded-lg bg-background/10 grid place-items-center">
              <Upload className="size-5" />
            </div>
            <div className="text-left leading-tight">
              <div className="text-sm font-semibold">Upload New JD</div>
              <div className="text-[11px] opacity-70">Start a new search in 60 seconds</div>
            </div>
            <ArrowUpRight className="size-4 ml-2 opacity-70 group-hover:translate-x-0.5 transition" />
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border bg-card p-5">
              <div className={`size-10 rounded-lg grid place-items-center bg-gradient-to-br ${k.tone}`}>
                <Icon className="size-5" />
              </div>
              <div className="mt-3 text-3xl font-semibold tabular-nums">{k.value}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{k.label}</div>
            </div>
          );
        })}
      </div>

      {/* Positions */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Your open positions</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Click any role to review candidates</p>
          </div>
          <Link to="/client/positions" className="text-sm text-primary font-medium">View all</Link>
        </div>

        <div className="grid gap-3">
          {loading && (
            <CardListSkeleton rows={3} />
          )}
          {!loading && positions.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
              No positions yet. Upload a JD to get started.
            </div>
          )}
          {positions.map((p) => (
            <Link key={p.id} to="/client/positions/$positionId" params={{ positionId: p.id }}
              className="group rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-primary/30 transition">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold group-hover:text-primary transition">{p.title}</h3>
                    <ClientStatusBadge status={p.status} />
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
                    <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{p.location ?? "—"}</span>
                    <span>{p.experience} · {p.salary}</span>
                    <span>{p.openings} opening{p.openings>1?"s":""}</span>
                    <span>Posted {daysAgo(p.posted_at)}d ago</span>
                  </div>
                </div>
                <PositionFunnel f={funnelFor(appsByPosition.get(p.id) ?? [])} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "purple" | "warning" }) {
  const c = tone === "purple" ? "text-purple" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="text-center">
      <div className={`text-xl font-semibold tabular-nums ${c}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function PositionFunnel({ f }: { f: Funnel }) {
  return (
    <div className="flex items-center gap-5 shrink-0">
      <Stat label="Shared"      value={f.shared} />
      <Stat label="Shortlisted" value={f.shortlisted} tone="purple" />
      <Stat label="Interviewed" value={f.interview} />
      <Stat label="Offered"     value={f.offered} />
      <Stat label="Rejected"    value={f.rejected} tone="warning" />
    </div>
  );
}