import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trophy, Building2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CardListSkeleton } from "@/components/skeletons";
import { listPositions } from "@/lib/positions.functions";
import { listApplications } from "@/lib/candidates.functions";
import { initialsOf } from "@/lib/display";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/closed")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const fetchPositions = useServerFn(listPositions);
  const fetchApps = useServerFn(listApplications);
  const [clientFilter, setClientFilter] = useState<string | "all">("all");
  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: () => fetchPositions({ data: {} }),
  });
  const { data: apps = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchApps({ data: { stages: ["offered", "closed"] } }),
  });

  const placementsFor = (pid: string) =>
    apps.filter((a) => a.position_id === pid && (a.stage === "offered" || a.stage === "closed")).length;

  const groups = useMemo(() => {
    const closed = positions.filter((p) => p.status === "closed");
    const map = new Map<string, { id: string; name: string; color: string | null; positions: typeof closed; placements: number }>();
    for (const p of closed) {
      const cid = p.client?.id ?? "unknown";
      const cname = p.client?.name ?? "Unknown client";
      const g = map.get(cid) ?? { id: cid, name: cname, color: p.client?.color ?? null, positions: [], placements: 0 };
      g.positions.push(p);
      g.placements += placementsFor(p.id);
      map.set(cid, g);
    }
    return [...map.values()].sort((a, b) => b.placements - a.placements || a.name.localeCompare(b.name));
  }, [positions, apps]);

  const visible = clientFilter === "all" ? groups : groups.filter((g) => g.id === clientFilter);
  const totalClosed = groups.reduce((s, g) => s + g.positions.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Closed positions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Successful placements and historical mandates{totalClosed > 0 && <> · {totalClosed} closed across {groups.length} client{groups.length === 1 ? "" : "s"}</>}
        </p>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={clientFilter === "all"} onClick={() => setClientFilter("all")}>
            All clients · {totalClosed}
          </FilterChip>
          {groups.map((g) => (
            <FilterChip key={g.id} active={clientFilter === g.id} onClick={() => setClientFilter(g.id)}>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: g.color ?? "hsl(var(--muted-foreground))" }} />
                {g.name} · {g.positions.length}
              </span>
            </FilterChip>
          ))}
        </div>
      )}

      {isLoading && <CardListSkeleton rows={4} className="sm:grid-cols-2" />}
      {!isLoading && groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
          No closed positions yet.
        </div>
      )}

      <div className="space-y-8">
        {visible.map((g) => (
          <section key={g.id} className="space-y-3">
            <div className="flex items-center gap-3 border-b border-border pb-2">
              <div className="size-8 rounded-lg grid place-items-center text-xs font-semibold text-white shrink-0"
                style={{ background: g.color ?? "hsl(var(--muted-foreground))" }}>
                {initialsOf(g.name)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate inline-flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />{g.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {g.positions.length} closed position{g.positions.length === 1 ? "" : "s"} · {g.placements} placement{g.placements === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {g.positions.map((p) => {
                const placements = placementsFor(p.id);
                return (
                  <div key={p.id} className="rounded-xl border border-border bg-gradient-to-br from-success/5 to-card p-5">
                    <div className="flex items-center gap-2 text-success text-xs font-medium">
                      <Trophy className="size-4" /> Successfully closed
                    </div>
                    <div className="font-semibold mt-2">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.location ?? "—"}
                    </div>
                    <div className="text-sm mt-3 text-muted-foreground">
                      {placements} placement{placements === 1 ? "" : "s"} · {p.openings} opening{p.openings === 1 ? "" : "s"}
                    </div>
                    {p.salary && (
                      <div className="mt-3 text-xs text-muted-foreground">CTC band · <span className="text-foreground font-medium">{p.salary}</span></div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "text-xs px-3 py-1.5 rounded-full border transition",
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
      )}>
      {children}
    </button>
  );
}