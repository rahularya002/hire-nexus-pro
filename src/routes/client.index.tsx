import { createFileRoute, Link } from "@tanstack/react-router";
import { Upload, Briefcase, Users, CheckCircle2, Clock, ArrowUpRight, MapPin } from "lucide-react";
import { ClientShell, ClientStatusBadge } from "@/components/client-shell";
import { clientCompany, clientPositions } from "@/lib/client-data";

export const Route = createFileRoute("/client/")({
  component: () => <ClientShell><Dashboard /></ClientShell>,
});

function Dashboard() {
  const open = clientPositions.filter(p => p.status !== "closed").length;
  const totalCandidates = clientPositions.reduce((a, p) => a + p.candidates.length, 0);
  const shortlisted = clientPositions.flatMap(p => p.candidates).filter(c => c.status === "shortlisted" || c.status === "interview").length;
  const placed = clientPositions.filter(p => p.status === "closed").reduce((a, p) => a + p.openings, 0);

  const kpis = [
    { label: "Open positions", value: open, icon: Briefcase, tone: "from-info/15 to-info/5 text-info" },
    { label: "Candidates shared", value: totalCandidates, icon: Users, tone: "from-primary/15 to-primary/5 text-primary" },
    { label: "Shortlisted / Interviewing", value: shortlisted, icon: Clock, tone: "from-purple/15 to-purple/5 text-purple" },
    { label: "Placed (YTD)", value: placed, icon: CheckCircle2, tone: "from-success/15 to-success/5 text-success" },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border p-6 md:p-8 bg-gradient-to-br from-primary/10 via-purple/5 to-card">
        <div className="absolute -right-20 -top-20 size-64 rounded-full opacity-30 blur-3xl" style={{ background: clientCompany.color }} />
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{clientCompany.tagline}</div>
            <h1 className="text-3xl font-semibold tracking-tight mt-2">Welcome back, {clientCompany.name}</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              You have <span className="font-semibold text-foreground">{open} active mandates</span> and <span className="font-semibold text-foreground">{totalCandidates} candidates</span> to review.
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
          {clientPositions.map((p) => (
            <Link key={p.id} to="/client/positions/$positionId" params={{ positionId: p.id }}
              className="group rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-primary/30 transition">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold group-hover:text-primary transition">{p.title}</h3>
                    <ClientStatusBadge status={p.status} />
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
                    <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{p.location}</span>
                    <span>{p.experience} · {p.salary}</span>
                    <span>{p.openings} opening{p.openings>1?"s":""}</span>
                    <span>Posted {p.postedDays}d ago</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <Stat label="Shared" value={p.candidates.length} />
                  <Stat label="Shortlisted" value={p.candidates.filter(c=>c.status==="shortlisted"||c.status==="interview").length} tone="purple" />
                  <Stat label="Pending review" value={p.candidates.filter(c=>c.status==="pending").length} tone="warning" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
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