import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  Building2, Briefcase, CalendarClock, ClipboardList,
  TrendingUp, Trophy, ArrowUpRight, Sparkles, Upload, Star, CheckCircle2, UserPlus, Bell,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { clients, todaysInterviews, recentActivity, submissionTrend, positions } from "@/lib/mock-data";
import { Avatar, PriorityBadge, Section, StatusBadge } from "@/components/ui-bits";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/dashboard")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

const kpis = [
  { label: "Active Clients", value: clients.length, delta: "+2 this month", icon: Building2, tone: "primary" },
  { label: "Open Positions", value: positions.filter(p => p.status !== "closed").length, delta: "+5 this week", icon: Briefcase, tone: "info" },
  { label: "Today's Interviews", value: todaysInterviews.length, delta: "2 upcoming", icon: CalendarClock, tone: "purple" },
  { label: "Pending Tasks", value: 12, delta: "3 overdue", icon: ClipboardList, tone: "warning" },
  { label: "Submissions (MTD)", value: 86, delta: "+18% vs last", icon: TrendingUp, tone: "info" },
  { label: "Placements (MTD)", value: 14, delta: "₹1.4 Cr revenue", icon: Trophy, tone: "success" },
];

const toneClass: Record<string, string> = {
  primary: "from-primary/15 to-primary/5 text-primary",
  info: "from-info/15 to-info/5 text-info",
  purple: "from-purple/15 to-purple/5 text-purple",
  warning: "from-warning/20 to-warning/5 text-warning",
  success: "from-success/15 to-success/5 text-success",
};

const activityIcons = { upload: Upload, check: CheckCircle2, calendar: CalendarClock, star: Star, user: UserPlus } as const;
const activityTone: Record<string, string> = {
  info: "bg-info/15 text-info",
  success: "bg-success/15 text-success",
  purple: "bg-purple/15 text-purple",
  warning: "bg-warning/20 text-warning",
};

function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Wednesday, May 13</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Good afternoon, Aarav</h1>
          <p className="text-sm text-muted-foreground mt-1">Here's what's happening across your desk today.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary">
            <Bell className="size-4" /> 4 alerts
          </button>
          <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90">
            <Sparkles className="size-4" /> AI Talent Scout
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
              <div className={`size-9 rounded-lg grid place-items-center bg-gradient-to-br ${toneClass[k.tone]}`}>
                <Icon className="size-4.5" />
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{k.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
              <div className="text-[11px] text-foreground/60 mt-2 font-medium">{k.delta}</div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h3 className="font-semibold tracking-tight">Submissions & interviews</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Last 7 days</p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary" /> Submissions</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-purple" /> Interviews</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={submissionTrend} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.55 0.20 255)" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="oklch(0.55 0.20 255)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.20 295)" stopOpacity={0.35}/>
                    <stop offset="100%" stopColor="oklch(0.62 0.20 295)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="submissions" stroke="oklch(0.55 0.20 255)" strokeWidth={2} fill="url(#g1)" />
                <Area type="monotone" dataKey="interviews" stroke="oklch(0.62 0.20 295)" strokeWidth={2} fill="url(#g2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Today's interviews */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold tracking-tight">Today's interviews</h3>
            <Link to="/interviews" className="text-xs text-primary font-medium inline-flex items-center gap-1">
              View all <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {todaysInterviews.map((i) => (
              <div key={i.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-secondary/40 transition">
                <div className="text-xs font-semibold text-primary tabular-nums w-14 pt-0.5">{i.time}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{i.candidate}</div>
                  <div className="text-xs text-muted-foreground truncate">{i.position} · {i.client}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{i.round} · {i.mode}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active clients */}
      <Section
        title="Active clients"
        description="Top clients with open mandates"
        action={<Link to="/clients" className="text-sm text-primary font-medium inline-flex items-center gap-1">All clients <ArrowUpRight className="size-3.5" /></Link>}
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.slice(0, 6).map((c) => (
            <Link
              key={c.id}
              to="/clients/$clientId"
              params={{ clientId: c.id }}
              className="group rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <Avatar initials={c.initials} color={c.color} />
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.industry}</div>
                </div>
                <ArrowUpRight className="ml-auto size-4 text-muted-foreground group-hover:text-primary transition" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-md bg-secondary/60 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Open positions</div>
                  <div className="text-lg font-semibold tabular-nums">{c.openPositions}</div>
                </div>
                <div className="rounded-md bg-secondary/60 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Active candidates</div>
                  <div className="text-lg font-semibold tabular-nums">{c.activeCandidates}</div>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">SPOC · {c.contact}</div>
            </Link>
          ))}
        </div>
      </Section>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Hot positions */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold tracking-tight">Hot open requirements</h3>
              <p className="text-xs text-muted-foreground mt-0.5">High-priority roles needing attention</p>
            </div>
            <Link to="/positions" className="text-xs text-primary font-medium">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {positions.filter(p => p.priority === "high" && p.status !== "closed").map((p) => {
              const client = clients.find(c => c.id === p.clientId)!;
              return (
                <Link
                  key={p.id}
                  to="/positions/$positionId"
                  params={{ positionId: p.id }}
                  className="flex items-center gap-4 p-4 hover:bg-secondary/40 transition"
                >
                  <Avatar initials={client.initials} color={client.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium truncate">{p.title}</div>
                      <PriorityBadge priority={p.priority} />
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {client.name} · {p.location} · {p.experience} · {p.salary}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{p.candidates.length}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">candidates</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Activity feed */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold tracking-tight mb-4">Recent activity</h3>
          <div className="space-y-4">
            {recentActivity.map((a) => {
              const Icon = activityIcons[a.icon as keyof typeof activityIcons];
              return (
                <div key={a.id} className="flex gap-3">
                  <div className={`size-8 shrink-0 rounded-full grid place-items-center ${activityTone[a.tone]}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-snug">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.detail}</div>
                    <div className="text-[11px] text-muted-foreground/70 mt-0.5">{a.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
