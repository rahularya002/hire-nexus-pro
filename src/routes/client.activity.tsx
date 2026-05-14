import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity as ActivityIcon, UserPlus, Star, Calendar, FileText, MessageSquare, CheckCircle2 } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { activityEvents, type ActivityEvent } from "@/lib/client-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/activity")({
  component: () => <ClientShell><Page /></ClientShell>,
});

const ICONS: Record<ActivityEvent["type"], { icon: typeof UserPlus; tone: string }> = {
  submission: { icon: UserPlus,    tone: "bg-info/15 text-info" },
  shortlist:  { icon: Star,        tone: "bg-purple/15 text-purple" },
  interview:  { icon: Calendar,    tone: "bg-primary/15 text-primary" },
  offer:      { icon: CheckCircle2,tone: "bg-success/15 text-success" },
  document:   { icon: FileText,    tone: "bg-warning/15 text-warning" },
  message:    { icon: MessageSquare, tone: "bg-secondary text-foreground" },
  closed:     { icon: CheckCircle2,tone: "bg-success/15 text-success" },
};

function Page() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Account stream</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <ActivityIcon className="size-5 text-primary" /> Activity
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Every update from your recruitment partner, in one place.</p>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {activityEvents.map((e) => {
          const meta = ICONS[e.type];
          const Icon = meta.icon;
          const inner = (
            <div className="flex items-start gap-3 p-4 hover:bg-secondary/40 transition">
              <div className={cn("size-9 rounded-full grid place-items-center shrink-0", meta.tone)}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{e.title}</div>
                  {e.unread && <span className="size-1.5 rounded-full bg-primary" />}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{e.detail}</div>
              </div>
              <div className="text-[11px] text-muted-foreground whitespace-nowrap">{e.timeAgo}</div>
            </div>
          );
          return e.positionId ? (
            <Link key={e.id} to="/client/positions/$positionId" params={{ positionId: e.positionId }} className="block">
              {inner}
            </Link>
          ) : (
            <div key={e.id}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}