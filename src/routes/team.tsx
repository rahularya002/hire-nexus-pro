import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { recruiters, type RecruiterStatus } from "@/lib/ops/store";
import { Users, TrendingUp, Activity, Coffee, CircleOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/team")({ component: TeamPage });

function statusMeta(s: RecruiterStatus) {
  if (s === "Active") return { dot: "bg-success", label: "Active", Icon: Activity, cls: "text-success" };
  if (s === "Available") return { dot: "bg-info", label: "Available", Icon: Users, cls: "text-info" };
  if (s === "Break") return { dot: "bg-warning", label: "Break", Icon: Coffee, cls: "text-warning" };
  return { dot: "bg-muted-foreground", label: "Offline", Icon: CircleOff, cls: "text-muted-foreground" };
}

function TeamPage() {
  const summary = {
    online: recruiters.filter((r) => r.status !== "Offline").length,
    active: recruiters.filter((r) => r.status === "Active").length,
    sharesToday: recruiters.reduce((s, r) => s + r.sharesToday, 0),
    closuresMtd: recruiters.reduce((s, r) => s + r.closuresMtd, 0),
    avgConv: Math.round(recruiters.reduce((s, r) => s + r.conversionPct, 0) / recruiters.length),
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Operations</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
            <Users className="size-5 text-primary" /> Recruiter roster
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Live activity, attendance and productivity across the desk.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Online", value: summary.online },
            { label: "Actively working", value: summary.active },
            { label: "Shares today", value: summary.sharesToday },
            { label: "Closures MTD", value: summary.closuresMtd },
            { label: "Avg. conversion", value: `${summary.avgConv}%` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Recruiter</th>
                  <th className="text-left font-medium px-2 py-2.5">Status</th>
                  <th className="text-left font-medium px-2 py-2.5">Login</th>
                  <th className="text-right font-medium px-2 py-2.5">Clients</th>
                  <th className="text-right font-medium px-2 py-2.5">Positions</th>
                  <th className="text-right font-medium px-2 py-2.5">Shares today</th>
                  <th className="text-right font-medium px-2 py-2.5">Closures MTD</th>
                  <th className="text-right font-medium px-4 py-2.5">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recruiters.map((r) => {
                  const m = statusMeta(r.status);
                  return (
                    <tr key={r.id} className="hover:bg-secondary/30 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-gradient-to-br from-primary/30 to-purple/30 grid place-items-center text-xs font-semibold">
                            {r.initials}
                          </div>
                          <div className="leading-tight">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-[11px] text-muted-foreground">{r.role} · joined {r.joinedOn}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", m.cls)}>
                          <span className={cn("size-1.5 rounded-full", m.dot, r.status === "Active" && "animate-pulse")} />
                          {m.label}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-xs text-muted-foreground tabular-nums">{r.loginAt}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{r.assignedClients}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{r.assignedPositions}</td>
                      <td className="px-2 py-3 text-right tabular-nums font-medium">{r.sharesToday}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{r.closuresMtd}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 tabular-nums font-semibold text-success">
                          <TrendingUp className="size-3" />{r.conversionPct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}