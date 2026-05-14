import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Plus, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientShell, ClientStatusBadge } from "@/components/client-shell";
import { clientPositions, PROGRESS_STEPS, currentStep, recruiterFor, type ClientPosition } from "@/lib/client-data";

export const Route = createFileRoute("/client/positions")({
  component: () => <ClientShell><Page /></ClientShell>,
});

function Page() {
  const [filter, setFilter] = useState<"all" | "active" | "closed">("all");
  const filtered = clientPositions.filter((p) =>
    filter === "all" ? true : filter === "closed" ? p.status === "closed" : p.status !== "closed"
  );
  const active = clientPositions.filter((p) => p.status !== "closed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Sent to TalentFlow</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">My Requirements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clientPositions.length} requirement{clientPositions.length > 1 ? "s" : ""} · {active} active · live progress from your recruitment partner
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
        {filtered.map((p) => <RequirementCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}

function slaTone(days: number): { label: string; cls: string } {
  if (days <= 5)  return { label: "On track", cls: "bg-success/15 text-success border-success/25" };
  if (days <= 14) return { label: "Watch",    cls: "bg-warning/15 text-warning border-warning/25" };
  return                 { label: "Overdue",  cls: "bg-destructive/15 text-destructive border-destructive/25" };
}

function RequirementCard({ p }: { p: ClientPosition }) {
  const step = currentStep(p);
  const stepIndex = PROGRESS_STEPS.findIndex((s) => s.id === step);
  const recruiter = recruiterFor(p.recruiterId);
  const sla = slaTone(p.sentDaysAgo ?? p.postedDays);
  const f = p.funnel ?? { sourced: 0, shared: 0, shortlisted: 0, interview: 0, offered: 0, joined: 0 };
  const stepCount = (id: typeof PROGRESS_STEPS[number]["id"]) => {
    if (id === "sourcing")  return f.sourced;
    if (id === "shared")    return f.shared;
    if (id === "review")    return f.shortlisted;
    if (id === "interview") return f.interview;
    if (id === "offer")     return f.offered + f.joined;
    return null;
  };

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
            <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{p.location}</span>
            <span>{p.experience} · {p.salary}</span>
            <span>{p.openings} opening{p.openings > 1 ? "s" : ""}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3" />Sent {p.sentDaysAgo ?? p.postedDays}d ago</span>
            <span>Recruiter · <span className="text-foreground font-medium">{recruiter.name}</span></span>
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
            style={{ width: `${(stepIndex / (PROGRESS_STEPS.length - 1)) * 100}%` }} />
          <div className="relative grid" style={{ gridTemplateColumns: `repeat(${PROGRESS_STEPS.length}, minmax(0, 1fr))` }}>
            {PROGRESS_STEPS.map((s, i) => {
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