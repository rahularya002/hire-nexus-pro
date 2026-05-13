import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Plus } from "lucide-react";
import { ClientShell, ClientStatusBadge } from "@/components/client-shell";
import { clientPositions } from "@/lib/client-data";

export const Route = createFileRoute("/client/positions")({
  component: () => <ClientShell><Page /></ClientShell>,
});

function Page() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All positions</h1>
          <p className="text-sm text-muted-foreground mt-1">{clientPositions.length} positions · {clientPositions.filter(p=>p.status!=="closed").length} active</p>
        </div>
        <Link to="/client/upload" className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="size-4" /> Upload new JD
        </Link>
      </div>

      <div className="grid gap-3">
        {clientPositions.map(p => (
          <Link key={p.id} to="/client/positions/$positionId" params={{positionId: p.id}}
            className="rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-primary/30 transition">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{p.title}</h3>
                  <ClientStatusBadge status={p.status} />
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{p.location}</span>
                  <span>{p.experience} · {p.salary}</span>
                  <span>{p.openings} opening{p.openings>1?"s":""}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {p.skills.map(s => <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">{s}</span>)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-semibold tabular-nums">{p.candidates.length}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">candidates shared</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}