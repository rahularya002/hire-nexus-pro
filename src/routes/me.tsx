import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useCurrentRecruiter, useMyRole, useCan, setMyStatus, useRoster } from "@/lib/ops/access";
import type { RecruiterStatus } from "@/lib/ops/store";
import { opsTasks, interviewProcesses } from "@/lib/ops/store";
import { positions } from "@/lib/mock-data";
import { Activity, Coffee, CircleOff, Users, Briefcase, CalendarClock, ClipboardList, Workflow, Plus, Share2, Sparkles, Target, Bell, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/me")({ component: MyDesk });

const STATUSES: { value: RecruiterStatus; label: string; dot: string; cls: string }[] = [
  { value: "Available", label: "Available", dot: "bg-info", cls: "text-info" },
  { value: "Active", label: "Active", dot: "bg-success", cls: "text-success" },
  { value: "Break", label: "On Break", dot: "bg-warning", cls: "text-warning" },
  { value: "Offline", label: "Offline", dot: "bg-muted-foreground", cls: "text-muted-foreground" },
];

function statusMeta(s: RecruiterStatus) {
  return STATUSES.find((x) => x.value === s) ?? STATUSES[3];
}

function MyDesk() {
  const me = useCurrentRecruiter();
  const role = useMyRole();
  const can = useCan();
  const meStatus = statusMeta(me.status);
  const roster = useRoster();

  // Filter mock data to "me"
  const myTasks = opsTasks.filter((t) => t.recruiterId === me.id);
  const myOpenTasks = myTasks.filter((t) => t.state !== "Closed");
  const myInterviews = interviewProcesses.slice(0, Math.max(2, me.assignedPositions % 4));
  const myPositions = positions.slice(0, Math.min(me.assignedPositions, 5));
  const myCandidates: { id: string; name: string; role: string; initials: string; location: string; matchScore: number }[] = [
    { id: "mc1", name: "Arjun Malhotra", role: "Sr. Product Designer", initials: "AM", location: "Bengaluru", matchScore: 94 },
    { id: "mc2", name: "Sneha Kulkarni", role: "Engineering Manager", initials: "SK", location: "Mumbai", matchScore: 91 },
    { id: "mc3", name: "Karan Verma", role: "Full Stack Engineer", initials: "KV", location: "Pune", matchScore: 88 },
    { id: "mc4", name: "Ishita Banerjee", role: "Data Scientist", initials: "IB", location: "Hyderabad", matchScore: 86 },
    { id: "mc5", name: "Rahul Pillai", role: "Brand Marketing Lead", initials: "RP", location: "Delhi NCR", matchScore: 83 },
    { id: "mc6", name: "Devansh Singh", role: "DevOps Engineer", initials: "DS", location: "Bengaluru", matchScore: 77 },
  ].slice(0, Math.min(6, Math.max(3, me.assignedPositions)));

  const target = 8;
  const goalPct = Math.min(100, Math.round((me.closuresMtd / target) * 100));

  return (
    <AppShell>
      {/* Header card */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 via-purple/5 to-info/5 p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="size-14 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-lg font-semibold shadow-sm">
          {me.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Welcome back, {me.name.split(" ")[0]}</h1>
            <Badge variant="outline" className="font-normal">{role.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Logged in at {me.loginAt} · {role.permissions.length} permissions enabled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-card hover:bg-secondary/60 outline-none focus-visible:ring-1 focus-visible:ring-ring transition">
              <span className={cn("size-2 rounded-full", meStatus.dot, me.status === "Active" && "animate-pulse")} />
              <span className={cn("text-sm font-medium", meStatus.cls)}>{meStatus.label}</span>
              <ChevronRight className="size-3.5 rotate-90 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Set my status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUSES.map((s) => (
                <DropdownMenuItem key={s.value} onClick={() => setMyStatus(s.value)} className="cursor-pointer">
                  <span className={cn("size-2 rounded-full mr-2", s.dot)} />
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Open positions" value={me.assignedPositions} icon={Briefcase} />
        <Kpi label="Candidates" value={me.assignedClients * 6} icon={Users} />
        <Kpi label="Shares today" value={me.sharesToday} icon={Share2} accent="text-info" />
        <Kpi label="Closures MTD" value={me.closuresMtd} icon={Target} accent="text-success" />
        <Kpi label="Conversion" value={`${me.conversionPct}%`} icon={Activity} accent="text-purple" />
      </div>

      {/* Quick actions */}
      <div className="mt-5 flex flex-wrap gap-2">
        {can("positions.create") && (
          <Link to="/positions" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="size-4" /> New Position
          </Link>
        )}
        {can("pipeline.share") && (
          <Link to="/pipeline" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary/60">
            <Share2 className="size-4" /> Share to client
          </Link>
        )}
        {can("candidates.view") && (
          <Link to="/scout" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary/60">
            <Sparkles className="size-4 text-primary" /> Run AI Scout
          </Link>
        )}
        <Link to="/interviews" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary/60">
          <CalendarClock className="size-4" /> Schedule interview
        </Link>
      </div>

      {/* Main grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* My Positions */}
        {can("positions.view") && (
          <Section title="My Positions" icon={Briefcase} action={<Link to="/positions" className="text-xs text-primary font-medium">View all</Link>} className="lg:col-span-2">
            <div className="divide-y divide-border">
              {myPositions.map((p) => (
                <Link key={p.id} to="/positions/$positionId" params={{ positionId: p.id }} className="flex items-center justify-between gap-3 py-2.5 hover:bg-secondary/40 px-2 -mx-2 rounded-md transition">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.title}</div>
                    <div className="text-[11px] text-muted-foreground">{p.location} · {p.openings} opening{p.openings>1?"s":""} · posted {p.postedDays}d ago</div>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] capitalize", p.priority === "high" && "border-destructive/40 text-destructive")}>
                    {p.priority}
                  </Badge>
                </Link>
              ))}
              {myPositions.length === 0 && <Empty>No positions assigned yet.</Empty>}
            </div>
          </Section>
        )}

        {/* My Tasks */}
        <Section title="Tasks due" icon={ClipboardList} action={<Link to="/tasks" className="text-xs text-primary font-medium">All tasks</Link>}>
          <div className="space-y-2">
            {myOpenTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="rounded-md border border-border p-2.5">
                <div className="text-xs font-medium line-clamp-2">{t.title}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-muted-foreground">{t.due}</span>
                  <span className={cn("text-[10px] font-medium",
                    t.sla === "breach" && "text-destructive",
                    t.sla === "warning" && "text-warning",
                    t.sla === "ok" && "text-muted-foreground")}>
                    {t.state}
                  </span>
                </div>
              </div>
            ))}
            {myOpenTasks.length === 0 && <Empty>You're all caught up.</Empty>}
          </div>
        </Section>

        {/* Today's interviews */}
        {can("candidates.view") && (
          <Section title="Today's interviews" icon={CalendarClock} action={<Link to="/interviews" className="text-xs text-primary font-medium">Calendar</Link>} className="lg:col-span-2">
            <div className="space-y-2">
              {myInterviews.map((ip) => {
                const next = ip.rounds.find((r) => r.status === "Confirmed" || r.status === "Pending confirmation") ?? ip.rounds[0];
                return (
                  <Link key={ip.id} to="/interviews/$processId" params={{ processId: ip.id }} className="flex items-center gap-3 rounded-md border border-border p-2.5 hover:bg-secondary/40 transition">
                    <div className="size-9 rounded-full bg-secondary grid place-items-center text-xs font-semibold">{ip.candidateInitials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{ip.candidate} · <span className="text-muted-foreground font-normal">{ip.position}</span></div>
                      <div className="text-[11px] text-muted-foreground truncate">{next.kind} · {next.scheduledFor} · {next.provider}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{next.status}</Badge>
                  </Link>
                );
              })}
              {myInterviews.length === 0 && <Empty>No interviews today.</Empty>}
            </div>
          </Section>
        )}

        {/* Goal */}
        <Section title="Monthly target" icon={Target}>
          <div className="text-2xl font-semibold">{me.closuresMtd}<span className="text-sm font-normal text-muted-foreground"> / {target} closures</span></div>
          <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-purple" style={{ width: `${goalPct}%` }} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">{goalPct}% to goal · conversion {me.conversionPct}%</div>
        </Section>

        {/* My pipeline preview */}
        {can("candidates.view") && (
          <Section title="My pipeline" icon={Workflow} action={<Link to="/pipeline" className="text-xs text-primary font-medium">Open kanban</Link>} className="lg:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {myCandidates.map((c) => (
                <div key={c.id} className="rounded-md border border-border p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-full bg-secondary grid place-items-center text-[10px] font-semibold">{c.initials}</div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{c.role}</div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{c.location}</span>
                    <span className="text-[10px] font-semibold text-success">{c.matchScore}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Team presence */}
        {can("team.view") && (
          <Section title="Team presence" icon={Users} action={<Link to="/team" className="text-xs text-primary font-medium">Roster</Link>}>
            <div className="space-y-1.5">
              {roster.filter((r) => r.id !== me.id).map((r) => {
                const m = statusMeta(r.status);
                return (
                  <div key={r.id} className="flex items-center gap-2.5 py-1">
                    <div className="relative size-7 rounded-full bg-secondary grid place-items-center text-[10px] font-semibold">
                      {r.initials}
                      <span className={cn("absolute -bottom-0 -right-0 size-2 rounded-full ring-2 ring-card", m.dot)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{r.role}</div>
                    </div>
                    <span className={cn("text-[10px] font-medium", m.cls)}>{m.label}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Activity feed (mock) */}
        <Section title="Recent activity" icon={Bell} className="lg:col-span-2">
          <div className="space-y-2.5">
            {[
              { t: "Profile shared with Razorpay", d: "Arjun Malhotra · Sr. Product Designer", ago: "12m ago" },
              { t: "Interview slot proposed", d: "Sneha Kulkarni · Tata Digital · Wed 4:30 PM", ago: "1h ago" },
              { t: "Client feedback received", d: "Reliance Brands · Head of E-commerce", ago: "3h ago" },
              { t: "Candidate added to pipeline", d: "Karan Verma · Full Stack Engineer", ago: "Yesterday" },
            ].map((e, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">{e.t}</div>
                  <div className="text-[11px] text-muted-foreground">{e.d}</div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{e.ago}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <Icon className={cn("size-4 text-muted-foreground", accent)} />
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function Section({ title, icon: Icon, action, children, className }: { title: string; icon: React.ComponentType<{ className?: string }>; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground text-center py-6">{children}</div>;
}