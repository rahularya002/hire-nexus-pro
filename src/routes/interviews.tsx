import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Video, MapPin } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { todaysInterviews } from "@/lib/mock-data";

export const Route = createFileRoute("/interviews")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Interviews</h1>
        <p className="text-sm text-muted-foreground mt-1">Today's schedule · {todaysInterviews.length} interviews</p>
      </div>
      <div className="grid gap-3">
        {todaysInterviews.map(i => (
          <div key={i.id} className="rounded-xl border border-border bg-card p-5 flex items-center gap-5 hover:shadow-sm transition">
            <div className="text-center shrink-0">
              <div className="text-xs text-muted-foreground uppercase">Today</div>
              <div className="text-xl font-semibold tabular-nums text-primary">{i.time}</div>
            </div>
            <div className="w-px self-stretch bg-border" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{i.candidate}</div>
              <div className="text-sm text-muted-foreground">{i.position} · {i.client}</div>
              <div className="text-xs text-muted-foreground mt-1.5 inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1">{i.mode === "On-site" ? <MapPin className="size-3" /> : <Video className="size-3" />} {i.mode}</span>
                <span>{i.round}</span>
              </div>
            </div>
            <button className="text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Join</button>
          </div>
        ))}
      </div>
    </div>
  );
}