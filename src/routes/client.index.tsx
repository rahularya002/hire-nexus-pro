import { createFileRoute, Link } from "@tanstack/react-router";
import { Upload, Send, Star, CalendarCheck, Award, XCircle, ArrowUpRight, MapPin } from "lucide-react";
import { ClientShell, ClientStatusBadge } from "@/components/client-shell";
import { clientCompany, clientPositions } from "@/lib/client-data";

export const Route = createFileRoute("/client/")({
  component: () => <ClientShell><Dashboard /></ClientShell>,
});

function Dashboard() {
  const open = clientPositions.filter(p => p.status !== "closed").length;
  const totals = clientPositions.reduce(
    (a, p) => {
      const f = p.funnel ?? { sourced: 0, shared: 0, shortlisted: 0, interview: 0, offered: 0, joined: 0 };
      a.shared      += f.shared;
      a.shortlisted += f.shortlisted;
      a.interview   += f.interview;
      a.offered     += f.offered;
      a.rejected    += p.candidates.filter((c) => c.status === "rejected").length;
      return a;
    },
    { shared: 0, shortlisted: 0, interview: 0, offered: 0, rejected: 0 },
  );

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
        <div className="absolute -right-20 -top-20 size-64 rounded-full opacity-30 blur-3xl" style={{ background: clientCompany.color }} />
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{clientCompany.tagline}</div>
            <h1 className="text-3xl font-semibold tracking-tight mt-2">Welcome back, {clientCompany.name}</h1>
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
                <PositionFunnel p={p} />
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

function PositionFunnel({ p }: { p: typeof clientPositions[number] }) {
  const f = p.funnel ?? { sourced: 0, shared: 0, shortlisted: 0, interview: 0, offered: 0, joined: 0 };
  const rejected = p.candidates.filter((c) => c.status === "rejected").length;
  return (
    <div className="flex items-center gap-5 shrink-0">
      <Stat label="Shared"      value={f.shared} />
      <Stat label="Shortlisted" value={f.shortlisted} tone="purple" />
      <Stat label="Interviewed" value={f.interview} />
      <Stat label="Offered"     value={f.offered + f.joined} />
      <Stat label="Rejected"    value={rejected} tone="warning" />
    </div>
  );
}