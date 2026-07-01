import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, Briefcase, CalendarClock, ClipboardList,
  ArrowUpRight, Sparkles, AlertTriangle, MessageSquare,
  PhoneCall, Mail, CheckCircle2, RotateCcw, UserX, Activity, Coffee, Circle,
  Send, Phone, Clock,
} from "lucide-react";
import { getTeamMembers } from "@/lib/team.functions";
import { Users, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { PriorityBadge, StatusBadge } from "@/components/ui-bits";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { listActivities, formatRelative, type ActivityRow } from "@/lib/activities.functions";
import { listPositions, type PositionRow } from "@/lib/positions.functions";
import { listClients, type ClientRow } from "@/lib/clients.functions";
import { listTasks, TASK_STATES, type TaskRow, type TaskState } from "@/lib/tasks.functions";
import { listInterviews, formatInterviewWhen, type InterviewRow } from "@/lib/interviews.functions";
import { listTodayRecruiterLogins, type RecruiterLoginToday } from "@/lib/logins.functions";
import { colorFor, initialsOf } from "@/lib/display";
import { ActivityStreamSkeleton } from "@/components/skeletons";

type RecruiterStatus = "Active" | "Available" | "Break" | "Offline";

export const Route = createFileRoute("/dashboard")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <AppShell>
      <Cockpit />
    </AppShell>
  );
}

function statusDot(s: RecruiterStatus) {
  return s === "Active" ? "bg-success" : s === "Available" ? "bg-info" : s === "Break" ? "bg-warning" : "bg-muted-foreground";
}

const taskTabs: TaskState[] = [...TASK_STATES];

function isSameDay(iso: string | null | undefined, today: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.toDateString() === today.toDateString();
}

function Cockpit() {
  const [myStatus, setMyStatus] = useState<RecruiterStatus>("Active");
  const [taskTab, setTaskTab] = useState<TaskState>("Pending");
  const { roles, profile, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const dashboardLabel = isAdmin ? "Manager Dashboard" : "Recruiter Dashboard";

  const fetchPositions = useServerFn(listPositions);
  const fetchClients = useServerFn(listClients);
  const fetchTasks = useServerFn(listTasks);
  const fetchInterviews = useServerFn(listInterviews);
  const fetchActivities = useServerFn(listActivities);

  const { data: positions = [] } = useQuery<PositionRow[]>({ queryKey: ["positions"], queryFn: () => fetchPositions({ data: {} }) });
  const { data: clientRows = [] } = useQuery<ClientRow[]>({ queryKey: ["clients"], queryFn: () => fetchClients() });
  const { data: tasks = [] } = useQuery<TaskRow[]>({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const { data: todayInterviews = [] } = useQuery<InterviewRow[]>({ queryKey: ["interviews", "today"], queryFn: () => fetchInterviews({ data: { scope: "today" } }) });
  const { data: activitiesAll = [] } = useQuery<ActivityRow[]>({ queryKey: ["activities", "digest"], queryFn: () => fetchActivities({ data: { limit: 200 } }) });

  const today = new Date();
  const todayShares    = activitiesAll.filter((a) => a.kind === "share"               && isSameDay(a.occurred_at, today)).length;
  const todayOffers    = activitiesAll.filter((a) => a.kind === "offer"               && isSameDay(a.occurred_at, today)).length;
  const todayClosures  = activitiesAll.filter((a) => a.kind === "closure"             && isSameDay(a.occurred_at, today)).length;
  const todayInterviewCount = todayInterviews.length;

  const myOpenPositions = positions.filter((p) => p.status !== "closed").slice(0, 6);
  const myTasks = tasks.filter((t) => t.state === taskTab);
  const pendingTasks = tasks.filter((t) => t.state === "Pending");
  const interviewPending = tasks.filter((t) => t.state === "Interview Pending");
  const slaBreaches = tasks.filter((t) => t.sla === "breach" || t.sla === "warning").slice(0, 5);
  const recentInactive = clientRows
    .filter((c) => {
      if (!c.last_activity_at) return true;
      const days = (Date.now() - new Date(c.last_activity_at).getTime()) / (1000 * 60 * 60 * 24);
      return days > 14;
    })
    .slice(0, 4);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (profile?.full_name?.trim().split(/\s+/)[0])
    || (profile?.email?.split("@")[0])
    || (user?.email?.split("@")[0])
    || "there";

  const digest = [
    { label: "Profiles shared", value: todayShares,         delta: `${activitiesAll.filter((a) => a.kind === "share").length} all-time` },
    { label: "Interviews",      value: todayInterviewCount, delta: `${todayInterviews.filter((i) => i.status === "pending_confirmation").length} pending` },
    { label: "Offers",          value: todayOffers,         delta: `${activitiesAll.filter((a) => a.kind === "offer").length} all-time` },
    { label: "Closures",        value: todayClosures,       delta: `${activitiesAll.filter((a) => a.kind === "closure").length} all-time` },
  ];

  const fetchUpcoming = useServerFn(listInterviews);
  const { data: upcomingInterviews = [] } = useQuery<InterviewRow[]>({
    queryKey: ["interviews", "upcoming"],
    queryFn: () => fetchUpcoming({ data: { scope: "upcoming" } }),
    enabled: isAdmin,
  });

  if (isAdmin) {
    return (
      <AdminDashboard
        firstName={firstName}
        greeting={greeting}
        dateLabel={dateLabel}
        clients={clientRows}
        positions={positions}
        tasks={tasks}
        todayInterviews={todayInterviews}
        upcomingInterviews={upcomingInterviews}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{dashboardLabel} · {dateLabel}</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">{greeting}, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-1">{isAdmin ? "Full agency view — every active mandate, recruiter and client." : "Your active mandates, tasks and conversations in one place."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Status switcher */}
          <div className="inline-flex rounded-md border border-border bg-card overflow-hidden">
            {(["Active", "Available", "Break", "Offline"] as RecruiterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setMyStatus(s)}
                className={cn(
                  "h-9 px-2.5 text-xs font-medium inline-flex items-center gap-1.5 transition",
                  myStatus === s ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                )}
              >
                <span className={cn("size-1.5 rounded-full", statusDot(s))} />
                {s}
              </button>
            ))}
          </div>
          <Link to="/scout" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90">
            <Sparkles className="size-4" /> AI Scout
          </Link>
        </div>
      </div>

      {/* Daily Digest */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h3 className="font-semibold text-sm tracking-tight">Daily digest</h3>
          </div>
          <span className="text-[11px] text-muted-foreground">Resets at midnight IST</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {digest.map((d) => (
            <div key={d.label} className="rounded-lg bg-background/60 border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.label}</div>
              <div className="text-2xl font-semibold tabular-nums mt-0.5">{d.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{d.delta}</div>
            </div>
          ))}
        </div>
      </div>

      {isAdmin && <TeamPulse />}

      {/* Top row: My Active Clients, My Open Positions, Today's Interviews */}
      <div className="grid lg:grid-cols-3 gap-4">
        {isAdmin ? (
        <CockpitCard title="Inactive / quiet clients" count={recentInactive.length} icon={UserX} link="/admin/clients" tone="warning">
          <div className="space-y-2">
            {recentInactive.length === 0 && (
              <div className="text-xs text-muted-foreground p-2">All clients are active.</div>
            )}
            {recentInactive.map((c) => (
              <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }} className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/60 transition">
                <div className="size-9 rounded-md grid place-items-center text-[11px] font-semibold text-primary-foreground shrink-0"
                     style={{ background: colorFor(c.id, c.color) }}>
                  {initialsOf(c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.industry ?? "—"} · {c.open_positions ?? 0} open</div>
                </div>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/15 text-warning shrink-0">Quiet</span>
              </Link>
            ))}
          </div>
        </CockpitCard>
        ) : (
        <CockpitCard title="Active clients" count={clientRows.length} icon={Building2} link="/admin/clients">
          <div className="space-y-2">
            {clientRows.slice(0, 4).map((c) => (
              <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }} className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/60 transition">
                <div className="size-9 rounded-md grid place-items-center text-[11px] font-semibold text-primary-foreground shrink-0"
                     style={{ background: colorFor(c.id, c.color) }}>
                  {initialsOf(c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.industry ?? "—"} · {c.open_positions ?? 0} open</div>
                </div>
              </Link>
            ))}
            {clientRows.length === 0 && <div className="text-xs text-muted-foreground p-2">No clients yet.</div>}
          </div>
        </CockpitCard>
        )}

        <CockpitCard title="My open positions" count={myOpenPositions.length} icon={Briefcase} link="/positions">
          <div className="space-y-2">
            {myOpenPositions.slice(0, 4).map((p) => (
                <Link key={p.id} to="/positions/$positionId" params={{ positionId: p.id }} className="flex items-start gap-2 p-2 rounded-md hover:bg-secondary/60 transition">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{p.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{p.client?.name ?? "—"} · {p.location ?? "—"}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <PriorityBadge priority={p.priority} />
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{p.openings}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">openings</div>
                  </div>
                </Link>
            ))}
            {myOpenPositions.length === 0 && <div className="text-xs text-muted-foreground p-2">No open positions.</div>}
          </div>
        </CockpitCard>

        <CockpitCard title="Today's interviews" count={todayInterviews.length} icon={CalendarClock} link="/interviews">
          <div className="space-y-2">
            {todayInterviews.map((i) => (
              <div key={i.id} className="flex items-start gap-3 p-2 rounded-md border border-border/60 hover:border-primary/30 transition">
                <div className="text-xs font-semibold text-primary tabular-nums w-20 pt-0.5">{formatInterviewWhen(i.scheduled_at).replace("Today · ", "")}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{i.candidate?.name ?? "Candidate"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{i.kind.replace(/_/g, " ")} · {i.position?.client?.name ?? "—"}</div>
                </div>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">{i.status.replace(/_/g, " ")}</span>
              </div>
            ))}
            {todayInterviews.length === 0 && <div className="text-xs text-muted-foreground p-2">No interviews scheduled today.</div>}
          </div>
        </CockpitCard>
      </div>

      {isAdmin && (
        <div className="grid lg:grid-cols-2 gap-4">
          <UpcomingInterviewsCard rows={upcomingInterviews} />
          <ClientsByRecruiterCard />
        </div>
      )}

      {/* Tasks panel with state tabs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            <h3 className="font-semibold tracking-tight">Tasks</h3>
            <span className="text-[11px] text-muted-foreground">· {tasks.length} total</span>
          </div>
          <Link to="/tasks" className="text-xs text-primary font-medium inline-flex items-center gap-1">
            Open task board <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <div className="px-4 pt-3 flex flex-wrap gap-1 border-b border-border">
          {taskTabs.map((s) => {
            const count = tasks.filter((t) => t.state === s).length;
            const active = taskTab === s;
            return (
              <button
                key={s}
                onClick={() => setTaskTab(s)}
                className={cn(
                  "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition inline-flex items-center gap-1.5",
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <TaskStateIcon state={s} />
                {s}
                <span className={cn("rounded-full px-1.5 py-0 text-[10px] tabular-nums", active ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="divide-y divide-border">
          {myTasks.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No tasks in this state.</div>
          )}
          {myTasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-3 hover:bg-secondary/40 transition">
              <TaskKindBadge kind={t.kind} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {t.notes ?? t.kind}
                </div>
              </div>
              <div className={cn(
                "text-[11px] font-medium px-2 py-0.5 rounded-md",
                t.sla === "breach" ? "bg-destructive/10 text-destructive" : t.sla === "warning" ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"
              )}>
                <Clock className="size-3 inline -mt-0.5 mr-1" />{t.due_label ?? (t.due_at ? new Date(t.due_at).toLocaleDateString() : "—")}
              </div>
              <div className="hidden sm:flex items-center gap-1">
                <QuickAction icon={Phone} label="Call" />
                <QuickAction icon={Send} label="WhatsApp" />
                <QuickAction icon={Mail} label="Email" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmations + Follow-ups + SLA */}
      <div className="grid lg:grid-cols-3 gap-4">
        <CockpitCard title="Interview confirmations pending" count={interviewPending.length} icon={MessageSquare}>
          <div className="space-y-2">
            {interviewPending.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-secondary/60 transition">
                <div className="size-7 rounded-md bg-purple/15 text-purple grid place-items-center shrink-0">
                  <CalendarClock className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.title}</div>
                  <div className="text-[11px] text-muted-foreground">{c.due_label ?? "—"}</div>
                </div>
              </div>
            ))}
            {interviewPending.length === 0 && <div className="text-xs text-muted-foreground p-2">Nothing pending.</div>}
          </div>
        </CockpitCard>

        <CockpitCard title="Follow-ups pending" count={pendingTasks.length} icon={PhoneCall}>
          <div className="space-y-2">
            {pendingTasks.slice(0, 4).map((t) => (
              <div key={t.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-secondary/60 transition">
                <div className="size-7 rounded-md bg-info/15 text-info grid place-items-center shrink-0">
                  <PhoneCall className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">due {t.due_label ?? "—"}</div>
                </div>
              </div>
            ))}
            {pendingTasks.length === 0 && <div className="text-xs text-muted-foreground p-2">All clear.</div>}
          </div>
        </CockpitCard>

        <CockpitCard title="SLA warnings" count={slaBreaches.length} icon={AlertTriangle} tone="warning">
          <div className="space-y-2">
            {slaBreaches.map((s) => (
              <div key={s.id} className={cn(
                "p-2.5 rounded-md border",
                s.sla === "breach" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
              )}>
                <div className="text-sm font-medium leading-snug">{s.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{s.due_label ?? (s.due_at ? new Date(s.due_at).toLocaleString() : "—")}</div>
              </div>
            ))}
            {slaBreaches.length === 0 && <div className="text-xs text-muted-foreground p-2">No SLA risks.</div>}
          </div>
        </CockpitCard>
      </div>

      {/* Recruiter activity status */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <DashboardActivityFeed />
      </div>

      {isAdmin && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <RecruiterLoginsToday />
        </div>
      )}
    </div>
  );
}

function CockpitCard({
  title, count, icon: Icon, link, children, tone = "primary",
}: {
  title: string; count: number; icon: React.ElementType; link?: string; children: React.ReactNode; tone?: "primary" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            "size-7 rounded-md grid place-items-center shrink-0",
            tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"
          )}>
            <Icon className="size-4" />
          </div>
          <h3 className="font-semibold tracking-tight text-sm truncate">{title}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
        </div>
        {link && (
          <Link to={link} className="text-[11px] text-primary font-medium inline-flex items-center gap-0.5">
            All <ArrowUpRight className="size-3" />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function TaskStateIcon({ state }: { state: TaskState }) {
  const map: Record<TaskState, { Icon: React.ElementType; cls: string }> = {
    "Pending": { Icon: Circle, cls: "text-muted-foreground" },
    "Ongoing": { Icon: Activity, cls: "text-info" },
    "Interview Pending": { Icon: CalendarClock, cls: "text-purple" },
    "Closed": { Icon: CheckCircle2, cls: "text-success" },
    "Reopened": { Icon: RotateCcw, cls: "text-warning" },
    "No-show": { Icon: UserX, cls: "text-destructive" },
  };
  const { Icon, cls } = map[state];
  return <Icon className={cn("size-3.5", cls)} />;
}

function TaskKindBadge({ kind }: { kind: string }) {
  return (
    <span className="hidden md:inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-md bg-secondary text-muted-foreground border border-border">
      {kind}
    </span>
  );
}

function QuickAction({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button title={label} className="size-7 rounded-md hover:bg-secondary grid place-items-center text-muted-foreground hover:text-foreground transition">
      <Icon className="size-3.5" />
    </button>
  );
}

function ChannelIcon({ channel }: { channel: "WhatsApp" | "Email" | "Call" }) {
  const map = {
    WhatsApp: { Icon: Send, cls: "bg-success/15 text-success" },
    Email: { Icon: Mail, cls: "bg-info/15 text-info" },
    Call: { Icon: Phone, cls: "bg-purple/15 text-purple" },
  };
  const { Icon, cls } = map[channel];
  return (
    <div className={cn("size-7 rounded-md grid place-items-center shrink-0", cls)}>
      <Icon className="size-3.5" />
    </div>
  );
}

// Suppress unused import warning for Coffee (reserved for future Break visual)
void Coffee;

function RecruiterLoginsToday() {
  const fetchLogins = useServerFn(listTodayRecruiterLogins);
  const { data: rows = [], isLoading } = useQuery<RecruiterLoginToday[]>({
    queryKey: ["recruiter-logins-today"],
    queryFn: () => fetchLogins(),
    refetchInterval: 60_000,
  });

  const loggedIn = rows.filter((r) => r.logged_in_today);
  const offline = rows.filter((r) => !r.logged_in_today);

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <>
      <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h3 className="font-semibold tracking-tight">Recruiter logins today</h3>
          <span className="text-[11px] text-muted-foreground">
            {loggedIn.length}/{rows.length} signed in
          </span>
        </div>
        <Link to="/team" className="text-xs text-primary font-medium inline-flex items-center gap-1">
          Team roster <ArrowUpRight className="size-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {isLoading && (
          <div className="p-6 text-sm text-muted-foreground text-center">Loading…</div>
        )}
        {!isLoading && rows.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">No teammates yet.</div>
        )}
        {[...loggedIn, ...offline].map((r) => {
          const name = r.full_name || r.email || "Teammate";
          return (
            <div key={r.user_id} className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition">
              <div
                className="size-8 rounded-md grid place-items-center text-[10px] font-semibold text-primary-foreground shrink-0"
                style={{ background: colorFor(r.user_id) }}
              >
                {initialsOf(name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {r.role ?? "recruiter"} · {r.email ?? "—"}
                </div>
              </div>
              {r.logged_in_today ? (
                <div className="text-right shrink-0">
                  <div className="text-xs font-medium tabular-nums">
                    <span className="inline-block size-1.5 rounded-full bg-success mr-1.5 align-middle" />
                    First {fmt(r.first_login_at)}
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    Last activity {fmt(r.last_login_at)}
                  </div>
                </div>
              ) : (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                  Not signed in
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function DashboardActivityFeed() {
  const fetchActivities = useServerFn(listActivities);
  const { data: events = [], isLoading } = useQuery<ActivityRow[]>({
    queryKey: ["dashboard-activities"],
    queryFn: () => fetchActivities({ data: { limit: 8 } }),
  });
  return (
    <>
      <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h3 className="font-semibold tracking-tight">Recent activity</h3>
          <span className="text-[11px] text-muted-foreground">{events.length} recent events</span>
        </div>
        <Link to="/activity" className="text-xs text-primary font-medium inline-flex items-center gap-1">
          View all <ArrowUpRight className="size-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {isLoading && <ActivityStreamSkeleton rows={5} />}
        {!isLoading && events.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">No activity recorded yet.</div>
        )}
        {events.map((e) => (
          <div key={e.id} className="flex items-start gap-3 p-3 hover:bg-secondary/30 transition">
            <div className="size-8 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0 text-[10px] font-semibold uppercase">
              {e.kind.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{e.title}</div>
              {e.detail && <div className="text-[11px] text-muted-foreground truncate">{e.detail}</div>}
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatRelative(e.occurred_at)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function TeamPulse() {
  const fetchTeam = useServerFn(getTeamMembers);
  const fetchLogins = useServerFn(listTodayRecruiterLogins);
  const { data: teamData } = useQuery({ queryKey: ["team-members"], queryFn: () => fetchTeam() });
  const { data: logins = [] } = useQuery<RecruiterLoginToday[]>({
    queryKey: ["recruiter-logins-today"],
    queryFn: () => fetchLogins(),
    refetchInterval: 60_000,
  });
  const members = teamData?.members ?? [];
  const loginMap = new Map(logins.map((l) => [l.user_id, l]));
  const onlineNow = members.filter((m) => m.status === "Active").length;
  const loggedToday = logins.filter((l) => l.logged_in_today).length;
  const activeWeek = members.filter((m) => m.activity7d > 0).length;

  const kpis = [
    { label: "Team size", value: members.length, icon: Users, tone: "primary" as const },
    { label: "Online now", value: onlineNow, icon: Activity, tone: "success" as const },
    { label: "Logged in today", value: loggedToday, icon: Clock, tone: "info" as const },
    { label: "Active this week", value: activeWeek, icon: TrendingUp, tone: "purple" as const },
  ];

  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  const toneCls: Record<"primary" | "success" | "info" | "purple", string> = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    info: "bg-info/15 text-info",
    purple: "bg-purple/15 text-purple",
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <h3 className="font-semibold tracking-tight">Team pulse</h3>
          <span className="text-[11px] text-muted-foreground">Live view of who's on today</span>
        </div>
        <Link to="/team" className="text-xs text-primary font-medium inline-flex items-center gap-1">
          Full roster <ArrowUpRight className="size-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-border">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center gap-2">
              <div className={cn("size-7 rounded-md grid place-items-center", toneCls[k.tone])}>
                <k.icon className="size-3.5" />
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{k.value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        {members.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">No teammates added yet.</div>
        )}
        {members.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Recruiter</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Login today</th>
                <th className="text-left px-4 py-2 font-medium">Assigned clients</th>
                <th className="text-left px-4 py-2 font-medium">Open roles</th>
                <th className="text-right px-4 py-2 font-medium">7d actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => {
                const login = loginMap.get(m.id);
                return (
                  <tr key={m.id} className="hover:bg-secondary/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="size-8 rounded-md grid place-items-center text-[10px] font-semibold text-primary-foreground shrink-0" style={{ background: colorFor(m.id) }}>
                          {m.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{m.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{m.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={cn("size-1.5 rounded-full", m.status === "Active" ? "bg-success" : m.status === "Available" ? "bg-info" : "bg-muted-foreground")} />
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      {login?.logged_in_today ? (
                        <span className="text-foreground">{fmtTime(login.first_login_at)}</span>
                      ) : (
                        <span className="text-muted-foreground">Not signed in</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.clients.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {m.clients.slice(0, 3).map((c) => (
                            <span key={c.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-primary-foreground" style={{ background: colorFor(c.id, c.color) }}>
                              {c.name}
                            </span>
                          ))}
                          {m.clients.length > 3 && (
                            <span className="text-[10px] text-muted-foreground px-1">+{m.clients.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">{m.assignedPositions}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-right font-medium">{m.activity7d}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function UpcomingInterviewsCard({ rows }: { rows: InterviewRow[] }) {
  const upcoming = rows.filter((r) => r.scheduled_at).slice(0, 8);
  const grouped = new Map<string, InterviewRow[]>();
  for (const r of upcoming) {
    const d = new Date(r.scheduled_at!);
    const key = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    grouped.set(key, [...(grouped.get(key) ?? []), r]);
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-purple/15 text-purple grid place-items-center">
            <CalendarClock className="size-4" />
          </div>
          <h3 className="font-semibold tracking-tight text-sm">Next 7 days · interviews</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{upcoming.length}</span>
        </div>
        <Link to="/interviews" className="text-[11px] text-primary font-medium inline-flex items-center gap-0.5">
          All <ArrowUpRight className="size-3" />
        </Link>
      </div>
      {upcoming.length === 0 && <div className="text-xs text-muted-foreground p-2">Nothing scheduled.</div>}
      <div className="space-y-3">
        {Array.from(grouped.entries()).map(([day, items]) => (
          <div key={day}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{day}</div>
            <div className="space-y-1.5">
              {items.map((i) => (
                <div key={i.id} className="flex items-center gap-3 p-2 rounded-md border border-border/60 hover:border-primary/30 transition">
                  <div className="text-xs font-semibold text-primary tabular-nums w-14 shrink-0">
                    {new Date(i.scheduled_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{i.candidate?.name ?? "Candidate"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{i.kind.replace(/_/g, " ")} · {i.position?.client?.name ?? "—"}</div>
                  </div>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                    {i.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminDashboard({
  firstName, greeting, dateLabel,
  clients, positions, tasks, todayInterviews, upcomingInterviews,
}: {
  firstName: string;
  greeting: string;
  dateLabel: string;
  clients: ClientRow[];
  positions: PositionRow[];
  tasks: TaskRow[];
  todayInterviews: InterviewRow[];
  upcomingInterviews: InterviewRow[];
}) {
  const [ivTab, setIvTab] = useState<"today" | "upcoming">("today");
  const fetchTeam = useServerFn(getTeamMembers);
  const fetchLogins = useServerFn(listTodayRecruiterLogins);
  const { data: teamData } = useQuery({ queryKey: ["team-members"], queryFn: () => fetchTeam() });
  const { data: logins = [] } = useQuery<RecruiterLoginToday[]>({
    queryKey: ["recruiter-logins-today"],
    queryFn: () => fetchLogins(),
    refetchInterval: 60_000,
  });

  const members = teamData?.members ?? [];
  const loginMap = new Map(logins.map((l) => [l.user_id, l]));
  const recruiterNameMap = new Map(members.map((m) => [m.id, { name: m.name, initials: m.initials }]));

  const activeThreshold = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const clientsSorted = [...clients].sort((a, b) => a.name.localeCompare(b.name));
  const inactiveCount = clientsSorted.filter((c) => !c.last_activity_at || new Date(c.last_activity_at).getTime() < activeThreshold).length;

  const openPositions = positions.filter((p) => p.status !== "closed");

  const openTasks = tasks.filter((t) => t.state !== "Closed");
  const priorityWeight = (t: TaskRow) =>
    t.priority === "High" ? 0 : t.priority === "Normal" ? 1 : 2;
  const tasksSorted = [...openTasks].sort((a, b) => priorityWeight(a) - priorityWeight(b));
  const taskGroups: Array<{ label: "High" | "Normal" | "Low"; items: TaskRow[] }> = [
    { label: "High",   items: tasksSorted.filter((t) => t.priority === "High") },
    { label: "Normal", items: tasksSorted.filter((t) => t.priority === "Normal") },
    { label: "Low",    items: tasksSorted.filter((t) => t.priority === "Low") },
  ];

  const fmtTime = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  const fmtDay = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—";

  const ivList = ivTab === "today" ? todayInterviews : upcomingInterviews;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Manager Dashboard · {dateLabel}</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">{greeting}, {firstName}</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 1. Clients */}
        <Section title="Clients"
          icon={Building2}
          meta={`${clientsSorted.length} total · ${inactiveCount} inactive`}
          link="/admin/clients"
          linkLabel="All clients"
        >
          {clientsSorted.length === 0 && <EmptyRow>No clients yet.</EmptyRow>}
          <div className="divide-y divide-border">
            {clientsSorted.slice(0, 8).map((c) => {
              const active = c.last_activity_at && new Date(c.last_activity_at).getTime() >= activeThreshold;
              return (
                <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }}
                  className="flex items-center gap-3 py-2.5 hover:bg-secondary/40 -mx-4 px-4 transition">
                  <div className="size-8 rounded-md grid place-items-center text-[10px] font-semibold text-primary-foreground shrink-0"
                    style={{ background: colorFor(c.id, c.color) }}>
                    {initialsOf(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{c.industry ?? "—"} · {c.open_positions ?? 0} open</div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 inline-flex items-center gap-1",
                    active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                  )}>
                    <span className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground")} />
                    {active ? "Active" : "Inactive"}
                  </span>
                </Link>
              );
            })}
          </div>
        </Section>

        {/* 2. Employees */}
        <Section title="Employees"
          icon={Users}
          meta={`${members.length} teammates · ${logins.filter((l) => l.logged_in_today).length} signed in`}
          link="/team"
          linkLabel="Team roster"
        >
          {members.length === 0 && <EmptyRow>No teammates added yet.</EmptyRow>}
          <div className="divide-y divide-border">
            {members.slice(0, 8).map((m) => {
              const login = loginMap.get(m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5 -mx-4 px-4 hover:bg-secondary/40 transition">
                  <div className="relative shrink-0">
                    <div className="size-8 rounded-md grid place-items-center text-[10px] font-semibold text-primary-foreground"
                      style={{ background: colorFor(m.id) }}>
                      {m.initials}
                    </div>
                    <span className={cn(
                      "absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-card",
                      m.status === "Active" ? "bg-success" : "bg-muted-foreground",
                    )} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{m.role}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {login?.logged_in_today ? (
                      <div className="text-xs tabular-nums font-medium">{fmtTime(login.first_login_at)}</div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">Not signed in</div>
                    )}
                    <div className="text-[10px] text-muted-foreground uppercase">Login</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* 3. Interviews */}
      <Section title="Interviews"
        icon={CalendarClock}
        meta={`${todayInterviews.length} today · ${upcomingInterviews.length} upcoming`}
        link="/interviews"
        linkLabel="All interviews"
        toolbar={
          <div className="inline-flex rounded-md border border-border bg-background overflow-hidden">
            {(["today", "upcoming"] as const).map((k) => (
              <button key={k} onClick={() => setIvTab(k)}
                className={cn(
                  "h-7 px-3 text-[11px] font-medium transition",
                  ivTab === k ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60",
                )}>
                {k === "today" ? "Today" : "Next 7 days"}
              </button>
            ))}
          </div>
        }
      >
        {ivList.length === 0 && (
          <EmptyRow>{ivTab === "today" ? "No interviews today." : "Nothing scheduled in the next 7 days."}</EmptyRow>
        )}
        <div className="divide-y divide-border">
          {ivList.slice(0, 10).map((i) => (
            <div key={i.id} className="flex items-center gap-3 py-2.5 -mx-4 px-4 hover:bg-secondary/40 transition">
              <div className="text-xs font-semibold text-primary tabular-nums w-24 shrink-0">
                {ivTab === "today" ? fmtTime(i.scheduled_at) : `${fmtDay(i.scheduled_at)} · ${fmtTime(i.scheduled_at)}`}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{i.candidate?.name ?? "Candidate"}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {i.kind.replace(/_/g, " ")} · {i.position?.client?.name ?? "—"}
                </div>
              </div>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                {i.status.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* 4. Open positions */}
      <Section title="Open positions"
        icon={Briefcase}
        meta={`${openPositions.length} open`}
        link="/positions"
        linkLabel="All positions"
      >
        {openPositions.length === 0 && <EmptyRow>No open positions.</EmptyRow>}
        <div className="overflow-x-auto -mx-4">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Position</th>
                <th className="text-left px-4 py-2 font-medium">Client</th>
                <th className="text-left px-4 py-2 font-medium">Recruiter</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Openings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {openPositions.slice(0, 10).map((p) => {
                const rec = p.assigned_recruiter_id ? recruiterNameMap.get(p.assigned_recruiter_id) : null;
                return (
                  <tr key={p.id} className="hover:bg-secondary/30 transition">
                    <td className="px-4 py-2.5">
                      <Link to="/positions/$positionId" params={{ positionId: p.id }} className="font-medium hover:text-primary">
                        {p.title}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">{p.location ?? "—"}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      {p.client ? (
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md text-primary-foreground"
                          style={{ background: colorFor(p.client.id, p.client.color) }}>
                          {p.client.name}
                        </span>
                      ) : <span className="text-[11px] text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {rec ? (
                        <div className="inline-flex items-center gap-1.5">
                          <div className="size-5 rounded grid place-items-center text-[9px] font-semibold text-primary-foreground"
                            style={{ background: colorFor(p.assigned_recruiter_id!) }}>
                            {rec.initials}
                          </div>
                          <span className="text-xs">{rec.name}</span>
                        </div>
                      ) : <span className="text-[11px] text-muted-foreground">Unassigned</span>}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums">{p.openings}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 5. Tasks */}
      <Section title="Tasks"
        icon={ClipboardList}
        meta={`${openTasks.length} open`}
        link="/tasks"
        linkLabel="Task board"
      >
        {openTasks.length === 0 && <EmptyRow>All tasks are closed.</EmptyRow>}
        <div className="space-y-4">
          {taskGroups.map((g) => g.items.length === 0 ? null : (
            <div key={g.label}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                  g.label === "High" ? "bg-destructive/15 text-destructive"
                  : g.label === "Normal" ? "bg-info/15 text-info"
                  : "bg-muted text-muted-foreground",
                )}>{g.label}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">{g.items.length}</span>
              </div>
              <div className="divide-y divide-border rounded-md border border-border">
                {g.items.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/40 transition">
                    <TaskStateIcon state={t.state} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{t.kind}</div>
                    </div>
                    <div className={cn(
                      "text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0 inline-flex items-center gap-1",
                      t.sla === "breach" ? "bg-destructive/10 text-destructive"
                      : t.sla === "warning" ? "bg-warning/15 text-warning"
                      : "bg-secondary text-muted-foreground",
                    )}>
                      <Clock className="size-3" />
                      {t.due_label ?? (t.due_at ? new Date(t.due_at).toLocaleDateString() : "—")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title, icon: Icon, meta, link, linkLabel, toolbar, children,
}: {
  title: string;
  icon: React.ElementType;
  meta?: string;
  link?: string;
  linkLabel?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-md grid place-items-center bg-primary/15 text-primary shrink-0">
            <Icon className="size-4" />
          </div>
          <h3 className="font-semibold tracking-tight text-sm truncate">{title}</h3>
          {meta && <span className="text-[11px] text-muted-foreground truncate">{meta}</span>}
        </div>
        <div className="flex items-center gap-2">
          {toolbar}
          {link && linkLabel && (
            <Link to={link} className="text-[11px] text-primary font-medium inline-flex items-center gap-0.5">
              {linkLabel} <ArrowUpRight className="size-3" />
            </Link>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground py-6 text-center">{children}</div>;
}

function ClientsByRecruiterCard() {
  const fetchTeam = useServerFn(getTeamMembers);
  const { data: teamData } = useQuery({ queryKey: ["team-members"], queryFn: () => fetchTeam() });
  const members = (teamData?.members ?? []).filter((m) => m.clients.length > 0);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-primary/15 text-primary grid place-items-center">
            <Building2 className="size-4" />
          </div>
          <h3 className="font-semibold tracking-tight text-sm">Who's working with whom</h3>
        </div>
        <Link to="/team" className="text-[11px] text-primary font-medium inline-flex items-center gap-0.5">
          Team <ArrowUpRight className="size-3" />
        </Link>
      </div>
      {members.length === 0 && <div className="text-xs text-muted-foreground p-2">No client assignments yet.</div>}
      <div className="space-y-3">
        {members.map((m) => (
          <div key={m.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-secondary/40 transition">
            <div className="size-8 rounded-md grid place-items-center text-[10px] font-semibold text-primary-foreground shrink-0" style={{ background: colorFor(m.id) }}>
              {m.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{m.name}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {m.clients.map((c) => (
                  <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-primary-foreground hover:opacity-90"
                    style={{ background: colorFor(c.id, c.color) }}>
                    {c.name} · {c.positions}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
