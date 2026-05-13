import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PIPELINE_STAGES, positions, clients } from "@/lib/mock-data";

export const Route = createFileRoute("/pipeline")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  // flatten candidates with context
  const all = positions.flatMap(p => p.candidates.map(c => ({ ...c, posTitle: p.title, posId: p.id, clientName: clients.find(x => x.id === p.clientId)!.name })));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">All candidates across {positions.length} active mandates</p>
      </div>
      <div className="grid grid-flow-col auto-cols-[260px] gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map(stage => {
          const list = all.filter(c => c.stage === stage);
          return (
            <div key={stage} className="rounded-xl border border-border bg-secondary/30">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <div className="text-sm font-medium">{stage}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{list.length}</div>
              </div>
              <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                {list.slice(0, 8).map(c => (
                  <Link key={c.id} to="/positions/$positionId" params={{positionId: c.posId}}
                    className="block rounded-lg bg-card border border-border p-3 hover:border-primary/30 transition">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground text-[10px] font-semibold grid place-items-center">{c.initials}</div>
                      <div className="text-sm font-medium truncate">{c.name}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1.5 truncate">{c.posTitle}</div>
                    <div className="text-[10px] text-muted-foreground/70 truncate">{c.clientName} · {c.matchScore}% match</div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}