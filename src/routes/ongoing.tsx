import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, StatusBadge } from "@/components/ui-bits";
import { positions, clients } from "@/lib/mock-data";

export const Route = createFileRoute("/ongoing")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const list = positions.filter(p => p.status === "in_progress" || p.status === "interviews");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ongoing mandates</h1>
        <p className="text-sm text-muted-foreground mt-1">{list.length} positions in active execution</p>
      </div>
      <div className="grid gap-3">
        {list.map(p => {
          const c = clients.find(x => x.id === p.clientId)!;
          return (
            <Link key={p.id} to="/positions/$positionId" params={{positionId: p.id}}
              className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg grid place-items-center text-sm font-bold text-primary-foreground" style={{background: c.color}}>{c.initials}</div>
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{c.name} · {p.location}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={p.priority} />
                  <StatusBadge status={p.status} />
                  <span className="text-sm font-semibold tabular-nums">{p.candidates.length} candidates</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}