import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Building2, Briefcase, CalendarClock, ClipboardList,
  ArrowUpRight, Sparkles, AlertTriangle, MessageSquare,
  PhoneCall, Mail, CheckCircle2, RotateCcw, UserX, Activity, Coffee, Circle,
  Send, Phone, Clock,
} from "lucide-react";
import { clients, todaysInterviews, positions } from "@/lib/mock-data";
import {
  opsTasks, tasksByState, pendingConfirmations, slaWarnings, dailyDigest,
  recruiters, type TaskState, type RecruiterStatus,
} from "@/lib/ops/store";
import { Avatar, PriorityBadge, StatusBadge } from "@/components/ui-bits";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";

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

const myActiveClients = clients.slice(0, 4);
const myOpenPositions = positions.filter((p) => p.status !== "closed").slice(0, 6);

function statusDot(s: RecruiterStatus) {
  return s === "Active" ? "bg-success" : s === "Available" ? "bg-info" : s === "Break" ? "bg-warning" : "bg-muted-foreground";
}

const taskTabs: TaskState[] = ["Pending", "Ongoing", "Interview Pending", "Closed", "Reopened", "No-show"];

function Cockpit() {
  const [myStatus, setMyStatus] = useState<RecruiterStatus>("Active");
  const [taskTab, setTaskTab] = useState<TaskState>("Pending");
  const myTasks = tasksByState(taskTab);

  const digest = [
    { label: "Profiles shared", ...dailyDigest.shares },
    { label: "Interviews", ...dailyDigest.interviews },
    { label: "Offers", ...dailyDigest.offers },
    { label: "Closures", ...dailyDigest.closures },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mission Control · Wed, May 14</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Good afternoon, Aarav</h1>
          <p className="text-sm text-muted-foreground mt-1">Your operational cockpit — every active mandate, task and conversation in one place.</p>
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

      {/* Top row: My Active Clients, My Open Positions, Today's Interviews */}
      <div className="grid lg:grid-cols-3 gap-4">
        <CockpitCard title="My active clients" count={myActiveClients.length} icon={Building2} link="/clients">
          <div className="space-y-2">
            {myActiveClients.map((c) => (
              <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }} className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/60 transition">
                <Avatar initials={c.initials} color={c.color} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.openPositions} open · {c.activeCandidates} active</div>
                </div>
                <ArrowUpRight className="size-3.5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </CockpitCard>

        <CockpitCard title="My open positions" count={myOpenPositions.length} icon={Briefcase} link="/positions">
          <div className="space-y-2">
            {myOpenPositions.slice(0, 4).map((p) => {
              const c = clients.find((x) => x.id === p.clientId)!;
              return (
                <Link key={p.id} to="/positions/$positionId" params={{ positionId: p.id }} className="flex items-start gap-2 p-2 rounded-md hover:bg-secondary/60 transition">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{p.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{c.name} · {p.location}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <PriorityBadge priority={p.priority} />
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{p.candidates.length}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">cands</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CockpitCard>

        <CockpitCard title="Today's interviews" count={todaysInterviews.length} icon={CalendarClock} link="/interviews">
          <div className="space-y-2">
            {todaysInterviews.map((i) => (
              <div key={i.id} className="flex items-start gap-3 p-2 rounded-md border border-border/60 hover:border-primary/30 transition">
                <div className="text-xs font-semibold text-primary tabular-nums w-14 pt-0.5">{i.time}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{i.candidate}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{i.round} · {i.client}</div>
                </div>
                <button className="text-[11px] font-medium text-primary hover:underline shrink-0">Confirm</button>
              </div>
            ))}
          </div>
        </CockpitCard>
      </div>

      {/* Tasks panel with state tabs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            <h3 className="font-semibold tracking-tight">Tasks</h3>
            <span className="text-[11px] text-muted-foreground">· {opsTasks.length} total</span>
          </div>
          <Link to="/tasks" className="text-xs text-primary font-medium inline-flex items-center gap-1">
            Open task board <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <div className="px-4 pt-3 flex flex-wrap gap-1 border-b border-border">
          {taskTabs.map((s) => {
            const count = tasksByState(s).length;
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
                  {t.client && <>{t.client} · </>}{t.position}{t.candidate && <> · {t.candidate}</>}
                </div>
              </div>
              <div className={cn(
                "text-[11px] font-medium px-2 py-0.5 rounded-md",
                t.sla === "breach" ? "bg-destructive/10 text-destructive" : t.sla === "warning" ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"
              )}>
                <Clock className="size-3 inline -mt-0.5 mr-1" />{t.due}
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
        <CockpitCard title="Candidate confirmations pending" count={pendingConfirmations.filter(c => c.state === "Awaiting response").length} icon={MessageSquare}>
          <div className="space-y-2">
            {pendingConfirmations.map((c) => (
              <div key={c.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/60 transition">
                <ChannelIcon channel={c.channel} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.candidate}</div>
                  <div className="text-[11px] text-muted-foreground">{c.state} · {c.when}</div>
                </div>
                <button className="text-[11px] font-medium text-primary hover:underline">Nudge</button>
              </div>
            ))}
          </div>
        </CockpitCard>

        <CockpitCard title="Follow-ups pending" count={tasksByState("Pending").length} icon={PhoneCall}>
          <div className="space-y-2">
            {tasksByState("Pending").slice(0, 4).map((t) => (
              <div key={t.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-secondary/60 transition">
                <div className="size-7 rounded-md bg-info/15 text-info grid place-items-center shrink-0">
                  <PhoneCall className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{t.client} · due {t.due}</div>
                </div>
              </div>
            ))}
          </div>
        </CockpitCard>

        <CockpitCard title="SLA warnings" count={slaWarnings.length} icon={AlertTriangle} tone="warning">
          <div className="space-y-2">
            {slaWarnings.map((s) => (
              <div key={s.id} className={cn(
                "p-2.5 rounded-md border",
                s.severity === "breach" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
              )}>
                <div className="text-sm font-medium leading-snug">{s.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{s.detail}</div>
              </div>
            ))}
          </div>
        </CockpitCard>
      </div>

      {/* Recruiter activity status */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h3 className="font-semibold tracking-tight">Recruiter activity</h3>
            <span className="text-[11px] text-muted-foreground">Live · Manager view</span>
          </div>
          <Link to="/team" className="text-xs text-primary font-medium inline-flex items-center gap-1">
            Open roster <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left font-medium px-4 py-2">Recruiter</th>
                <th className="text-left font-medium px-2 py-2">Status</th>
                <th className="text-right font-medium px-2 py-2">Login</th>
                <th className="text-right font-medium px-2 py-2">Clients</th>
                <th className="text-right font-medium px-2 py-2">Positions</th>
                <th className="text-right font-medium px-2 py-2">Shares today</th>
                <th className="text-right font-medium px-2 py-2">Closures</th>
                <th className="text-right font-medium px-4 py-2">Conv %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recruiters.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/30 transition">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-gradient-to-br from-primary/30 to-purple/30 grid place-items-center text-[10px] font-semibold">{r.initials}</div>
                      <div className="leading-tight">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[10px] text-muted-foreground">{r.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className={cn("size-1.5 rounded-full", statusDot(r.status), r.status === "Active" && "animate-pulse")} />
                      {r.status}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right text-xs text-muted-foreground tabular-nums">{r.loginAt}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{r.assignedClients}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{r.assignedPositions}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums font-medium">{r.sharesToday}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{r.closuresMtd}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-success">{r.conversionPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
