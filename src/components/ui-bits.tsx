import { cn } from "@/lib/utils";
import type { Priority, PositionStatus, CandidateStage } from "@/lib/mock-data";

export function PriorityBadge({ priority }: { priority: Priority }) {
  const map = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-warning/15 text-warning border-warning/30",
    low: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize", map[priority])}>
      <span className="size-1.5 rounded-full bg-current" />
      {priority} priority
    </span>
  );
}

export function StatusBadge({ status }: { status: PositionStatus }) {
  const map = {
    open: { c: "bg-warning/15 text-warning border-warning/25", l: "Open" },
    in_progress: { c: "bg-info/15 text-info border-info/25", l: "In Progress" },
    interviews: { c: "bg-purple/15 text-purple border-purple/25", l: "Interviews" },
    closed: { c: "bg-success/15 text-success border-success/25", l: "Closed" },
  };
  const v = map[status];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", v.c)}>
      {v.l}
    </span>
  );
}

export function StageBadge({ stage }: { stage: CandidateStage }) {
  const tone: Record<CandidateStage, string> = {
    "Sourcing": "bg-muted text-muted-foreground",
    "Recruiter Shortlist": "bg-info/15 text-info",
    "Shared with Client": "bg-primary/15 text-primary",
    "Client Shortlist": "bg-purple/15 text-purple",
    "Interview Scheduled": "bg-warning/15 text-warning",
    "Rounds": "bg-warning/20 text-warning",
    "Offered": "bg-success/15 text-success",
    "Closed": "bg-success/20 text-success",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium", tone[stage])}>
      {stage}
    </span>
  );
}

export function Avatar({ initials, color }: { initials: string; color?: string }) {
  return (
    <div
      className="size-10 rounded-lg grid place-items-center text-sm font-semibold text-primary-foreground shadow-sm shrink-0"
      style={{ background: color ?? "linear-gradient(135deg, var(--primary), var(--purple))" }}
    >
      {initials}
    </div>
  );
}

export function Section({ title, action, children, description }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}