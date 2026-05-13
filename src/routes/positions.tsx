import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Users, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar, PriorityBadge, StatusBadge } from "@/components/ui-bits";
import { positions, clients } from "@/lib/mock-data";

export const Route = createFileRoute("/positions")({
  component: () => <AppShell><PositionsPage /></AppShell>,
});

function PositionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Open requirements</h1>
          <p className="text-sm text-muted-foreground mt-1">{positions.filter(p=>p.status!=="closed").length} active mandates across {clients.length} clients</p>
        </div>
        <button className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="size-4" /> New position
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-secondary/30">
          <div className="col-span-5">Position</div>
          <div className="col-span-2">Client</div>
          <div className="col-span-2">Salary</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Pipeline</div>
        </div>
        <div className="divide-y divide-border">
          {positions.map((p) => {
            const client = clients.find(c => c.id === p.clientId)!;
            return (
              <Link key={p.id} to="/positions/$positionId" params={{ positionId: p.id }}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-secondary/40 transition">
                <div className="md:col-span-5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium truncate">{p.title}</div>
                    <PriorityBadge priority={p.priority} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                    <MapPin className="size-3" /> {p.location} · {p.experience}
                  </div>
                </div>
                <div className="md:col-span-2 flex items-center gap-2 min-w-0">
                  <div className="size-7 rounded-md grid place-items-center text-[10px] font-bold text-primary-foreground shrink-0" style={{background: client.color}}>{client.initials}</div>
                  <div className="text-sm truncate">{client.name}</div>
                </div>
                <div className="md:col-span-2 text-sm tabular-nums text-muted-foreground">{p.salary}</div>
                <div className="md:col-span-2"><StatusBadge status={p.status} /></div>
                <div className="md:col-span-1 md:text-right text-sm font-semibold tabular-nums inline-flex items-center md:justify-end gap-1">
                  <Users className="size-3.5 text-muted-foreground" /> {p.candidates.length}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}