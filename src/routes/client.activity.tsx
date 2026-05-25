import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Activity as ActivityIcon, UserPlus, Star, Calendar, FileText,
  MessageSquare, CheckCircle2, Phone, Share2, CalendarClock, Award,
} from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import {
  listActivities,
  formatRelative,
  type ActivityKind,
  type ActivityRow,
} from "@/lib/activities.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/activity")({
  component: () => <ClientShell><Page /></ClientShell>,
});

const ICONS: Record<ActivityKind, { icon: typeof UserPlus; tone: string }> = {
  submission:           { icon: UserPlus,      tone: "bg-info/15 text-info" },
  shortlist:            { icon: Star,          tone: "bg-purple/15 text-purple" },
  share:                { icon: Share2,        tone: "bg-primary/15 text-primary" },
  interview_scheduled:  { icon: CalendarClock, tone: "bg-warning/15 text-warning" },
  interview_completed:  { icon: Calendar,      tone: "bg-primary/15 text-primary" },
  offer:                { icon: Award,         tone: "bg-success/15 text-success" },
  closure:              { icon: CheckCircle2,  tone: "bg-success/15 text-success" },
  document:             { icon: FileText,      tone: "bg-warning/15 text-warning" },
  message:              { icon: MessageSquare, tone: "bg-secondary text-foreground" },
  note:                 { icon: FileText,      tone: "bg-secondary text-foreground" },
  call:                 { icon: Phone,         tone: "bg-info/15 text-info" },
  stage_change:         { icon: CheckCircle2,  tone: "bg-primary/15 text-primary" },
};

function Page() {
  const fetchActivities = useServerFn(listActivities);
  const { data: events = [], isLoading } = useQuery<ActivityRow[]>({
    queryKey: ["client-activities"],
    queryFn: () => fetchActivities({ data: { limit: 200 } }),
  });

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
        {isLoading && <ActivityStreamSkeleton rows={6} />}
        {!isLoading && events.length === 0 && (
          <div className="p-10 text-sm text-muted-foreground text-center">No activity yet.</div>
        )}
        {events.map((e) => {
          const meta = ICONS[e.kind];
          const Icon = meta.icon;
          return (
            <div key={e.id}>
            <div className="flex items-start gap-3 p-4 hover:bg-secondary/40 transition">
              <div className={cn("size-9 rounded-full grid place-items-center shrink-0", meta.tone)}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{e.title}</div>
                {e.detail && <div className="text-xs text-muted-foreground mt-0.5">{e.detail}</div>}
              </div>
              <div className="text-[11px] text-muted-foreground whitespace-nowrap">{formatRelative(e.occurred_at)}</div>
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}