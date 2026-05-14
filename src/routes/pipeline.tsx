import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PIPELINE_STAGES, positions, clients, type CandidateStage } from "@/lib/mock-data";
import { ArrowUpRight, Filter, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pipeline")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const [clientId, setClientId] = useState<string>("all");
  const [positionId, setPositionId] = useState<string>("all");

  const visiblePositions = useMemo(
    () => positions.filter((p) => clientId === "all" || p.clientId === clientId),
    [clientId]
  );

  const candidates = useMemo(
    () =>
      visiblePositions
        .filter((p) => positionId === "all" || p.id === positionId)
        .flatMap((p) =>
          p.candidates.map((c) => ({
            ...c,
            posTitle: p.title,
            posId: p.id,
            clientId: p.clientId,
            clientName: clients.find((x) => x.id === p.clientId)!.name,
          }))
        ),
    [visiblePositions, positionId]
  );

  // Per-client × per-position pipeline groupings (independent pipelines)
  const groupings = useMemo(() => {
    const visibleClients =
      clientId === "all" ? clients : clients.filter((c) => c.id === clientId);
    return visibleClients.map((client) => {
      const clientPositions = visiblePositions.filter(
        (p) => p.clientId === client.id && (positionId === "all" || p.id === positionId)
      );
      return { client, positions: clientPositions };
    }).filter((g) => g.positions.length > 0);
  }, [clientId, positionId, visiblePositions]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Drilldown</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
            <Workflow className="size-5 text-primary" /> Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Independent per-client × per-position pipelines · click any stage count to drill in.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter className="size-3.5 text-muted-foreground" />
          <select
            value={clientId}
            onChange={(e) => { setClientId(e.target.value); setPositionId("all"); }}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs"
          >
            <option value="all">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs"
          >
            <option value="all">All positions</option>
            {visiblePositions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <Link to="/database" className="h-8 px-3 inline-flex items-center rounded-md border border-border bg-card font-medium hover:bg-secondary">
            Candidate database →
          </Link>
        </div>
      </div>

      {/* Top-level summary by stage (click → drilldown for ALL filters) */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Stage totals</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {PIPELINE_STAGES.map((stage) => {
            const count = candidates.filter((c) => c.stage === stage).length;
            return (
              <Link
                key={stage}
                to="/pipeline/$stage"
                params={{ stage }}
                search={{ clientId: clientId === "all" ? undefined : clientId, positionId: positionId === "all" ? undefined : positionId }}
                className="rounded-lg border border-border bg-background/40 p-2.5 hover:border-primary/40 hover:bg-secondary/40 transition group"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{stage}</div>
                <div className="flex items-end justify-between mt-1">
                  <div className="text-2xl font-semibold tabular-nums">{count}</div>
                  <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary transition" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Per-client × per-position independent pipelines */}
      {groupings.map(({ client, positions: ps }) => (
        <div key={client.id} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-md grid place-items-center text-xs font-semibold text-primary-foreground" style={{ background: client.color }}>
              {client.initials}
            </div>
            <div>
              <div className="font-semibold">{client.name}</div>
              <div className="text-[11px] text-muted-foreground">{ps.length} active mandate{ps.length !== 1 && "s"} · independent pipelines per role</div>
            </div>
          </div>

          {ps.map((p) => {
            const total = p.candidates.length;
            return (
              <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-2 bg-secondary/30">
                  <div className="min-w-0">
                    <Link to="/positions/$positionId" params={{ positionId: p.id }} className="text-sm font-semibold hover:text-primary transition truncate inline-flex items-center gap-1">
                      {p.title} <ArrowUpRight className="size-3" />
                    </Link>
                    <div className="text-[11px] text-muted-foreground">{p.location} · {p.experience} · {total} candidates</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 lg:grid-cols-8 divide-x divide-border">
                  {PIPELINE_STAGES.map((stage) => {
                    const count = p.candidates.filter((c) => c.stage === stage).length;
                    return (
                      <Link
                        key={stage}
                        to="/pipeline/$stage"
                        params={{ stage }}
                        search={{ clientId: client.id, positionId: p.id }}
                        className={cn(
                          "p-3 text-center hover:bg-secondary/60 transition group",
                          count === 0 && "opacity-40"
                        )}
                      >
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">{stage}</div>
                        <div className="text-lg font-semibold tabular-nums mt-0.5 group-hover:text-primary transition">{count}</div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Re-export type for child route convenience
export type { CandidateStage };