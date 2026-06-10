import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { APPLICATION_STAGES, STAGE_LABEL, listApplications } from "@/lib/candidates.functions";
import { initialsOf } from "@/lib/display";
import { KanbanCardSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pipeline")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const fetchApps = useServerFn(listApplications);
  const { data: allApps = [], isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchApps({ data: {} }),
  });

  const [clientId, setClientId] = useState<string | "all">("all");

  const clientOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of allApps) {
      const id = a.position?.client?.id;
      const name = a.position?.client?.name;
      if (id && name && !m.has(id)) m.set(id, name);
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allApps]);

  const apps = useMemo(
    () => (clientId === "all" ? allApps : allApps.filter((a) => a.position?.client?.id === clientId)),
    [allApps, clientId],
  );

  const positionIds = new Set(apps.map((a) => a.position_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? "\u00A0" : `${apps.length} candidates across ${positionIds.size} mandates`}
        </p>
      </div>
      {clientOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setClientId("all")}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-medium transition",
              clientId === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground",
            )}
          >
            All clients
          </button>
          {clientOptions.map((c) => (
            <button
              key={c.id}
              onClick={() => setClientId(c.id)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-xs font-medium transition",
                clientId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-flow-col auto-cols-[260px] gap-3 overflow-x-auto pb-4">
        {APPLICATION_STAGES.map((stage) => {
          const list = apps.filter((a) => a.stage === stage);
          return (
            <div key={stage} className="rounded-xl border border-border bg-secondary/30">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <div className="text-sm font-medium">{STAGE_LABEL[stage]}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{list.length}</div>
              </div>
              <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                {isLoading ? (
                  <KanbanCardSkeleton rows={3} />
                ) : list.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border bg-card/30 px-3 py-6 text-center text-[11px] text-muted-foreground">
                    Empty
                  </div>
                ) : null}
                {!isLoading && list.slice(0, 20).map((a) => (
                  <Link
                    key={a.id}
                    to="/positions/$positionId"
                    params={{ positionId: a.position_id }}
                    className="block rounded-lg bg-card border border-border p-3 hover:border-primary/30 transition"
                  >
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground text-[10px] font-semibold grid place-items-center">
                        {initialsOf(a.candidate?.name)}
                      </div>
                      <div className="text-sm font-medium truncate">{a.candidate?.name ?? "Unknown"}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1.5 truncate">{a.position?.title}</div>
                    <div className="text-[10px] text-muted-foreground/70 truncate">
                      {a.position?.client?.name ?? "—"}
                      {a.match_score != null ? ` · ${a.match_score}% match` : ""}
                    </div>
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