import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Trophy } from "lucide-react";
import { positions, clients } from "@/lib/mock-data";

export const Route = createFileRoute("/closed")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const list = positions.filter(p => p.status === "closed");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Closed positions</h1>
        <p className="text-sm text-muted-foreground mt-1">Successful placements and historical mandates</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {list.map(p => {
          const c = clients.find(x => x.id === p.clientId)!;
          return (
            <div key={p.id} className="rounded-xl border border-border bg-gradient-to-br from-success/5 to-card p-5">
              <div className="flex items-center gap-2 text-success text-xs font-medium">
                <Trophy className="size-4" /> Successfully closed
              </div>
              <div className="font-semibold mt-2">{p.title}</div>
              <div className="text-xs text-muted-foreground">{c.name} · {p.location}</div>
              <div className="text-sm mt-3 text-muted-foreground">{p.salary} · {p.openings} placement{p.openings>1?"s":""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}