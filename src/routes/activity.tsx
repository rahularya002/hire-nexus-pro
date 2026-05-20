import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity as ActivityIcon, Phone, Star, Share2, CalendarClock,
  CheckCircle2, Award, FileText, TrendingUp, Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  recruiters,
  activityForRecruiter,
  allActivity,
  activitySummary,
  type ActivityKind,
  type ActivityEvent,
} from "@/lib/ops/store";
import { useAuth } from "@/lib/auth/auth-context";
import { useCurrentRecruiter } from "@/lib/ops/access";
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
};

function Page() {
  const { roles } = useAuth();
  const isManager = roles.includes("admin") || roles.includes("lead_recruiter");
  const me = useCurrentRecruiter();

  // Manager can pick any recruiter or "all"; non-manager is locked to themselves.
  const [picked, setPicked] = useState<string>(isManager ? "all" : me.id);
  const effective = isManager ? picked : me.id;

  const events: ActivityEvent[] = useMemo(
    () => (effective === "all" ? allActivity() : activityForRecruiter(effective)),
    [effective],
  );
  const summary = useMemo(
    () => activitySummary(effective === "all" ? undefined : effective),
    [effective],
  );

  const pickedRecruiter = recruiters.find((r) => r.id === effective);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Transparency</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
            <ActivityIcon className="size-5 text-primary" /> Recruiter activity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isManager
              ? "Every recruiter action — visible to managers and to each recruiter for self-tracking."
              : "Your activity stream. Track your throughput in real time."}
          </p>
        </div>

        {isManager && (
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <select
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            >
              <option value="all">All recruiters</option>
              {recruiters.map((r) => (
                <option key={r.id} value={r.id}>{r.name} · {r.role}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryTile label="Shares (24h)"      value={summary.shares}      icon={Share2}        tone="text-primary" />
        <SummaryTile label="Calls (24h)"       value={summary.calls}       icon={Phone}         tone="text-info" />
        <SummaryTile label="Interviews (24h)"  value={summary.interviews}  icon={CalendarClock} tone="text-warning" />
        <SummaryTile label="Offers (24h)"      value={summary.offers}      icon={Award}         tone="text-success" />
        <SummaryTile label="Closures (24h)"    value={summary.closures}    icon={CheckCircle2}  tone="text-success" />
      </div>

      {/* Manager leaderboard */}
      {isManager && effective === "all" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <h2 className="font-semibold tracking-tight text-sm">Leaderboard · today</h2>
          </div>
          <div className="divide-y divide-border">
            {recruiters
              .map((r) => ({ r, s: activitySummary(r.id) }))
              .sort((a, b) =>
                (b.s.shares + b.s.interviews * 2 + b.s.offers * 3 + b.s.closures * 4) -
                (a.s.shares + a.s.interviews * 2 + a.s.offers * 3 + a.s.closures * 4)
              )
              .map(({ r, s }) => (
                <button
                  key={r.id}
                  onClick={() => setPicked(r.id)}
                  className="w-full text-left px-4 py-3 hover:bg-secondary/40 transition flex items-center gap-3"
                >
                  <div className="size-9 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold">
                    {r.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.role}</div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <Stat label="Shares"     value={s.shares} />
                    <Stat label="Interviews" value={s.interviews} />
                    <Stat label="Offers"     value={s.offers} />
                    <Stat label="Closures"   value={s.closures} />
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold tracking-tight text-sm">
            {effective === "all" ? "All recruiter activity" : `${pickedRecruiter?.name}'s activity`}
          </h2>
          <span className="text-xs text-muted-foreground">{events.length} events</span>
        </div>
        <div className="divide-y divide-border">
          {events.length === 0 && (
            <div className="p-10 text-sm text-muted-foreground text-center">No activity recorded yet.</div>
          )}
          {events.map((e) => {
            const meta = KIND_META[e.kind];
            const Icon = meta.icon;
            const r = recruiters.find((x) => x.id === e.recruiterId);
            return (
              <div key={e.id} className="flex items-start gap-3 p-4 hover:bg-secondary/30 transition">
                <div className={cn("size-9 rounded-full grid place-items-center shrink-0", meta.tone)}>
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{e.detail}</div>
                  {effective === "all" && r && (
                    <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                      <span className="size-1 rounded-full bg-muted-foreground" />
                      by {r.name} · {r.role}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{e.when}</span>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}