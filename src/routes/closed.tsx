import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trophy, ChevronRight, MapPin } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CardListSkeleton } from "@/components/skeletons";
import { listPositions } from "@/lib/positions.functions";
import { listApplications } from "@/lib/candidates.functions";
import { listPlacements } from "@/lib/interviews.functions";
import { initialsOf } from "@/lib/display";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/closed")({
  component: () => <AppShell><Page /></AppShell>,
});

function fmtMonthYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Page() {
  const fetchPositions = useServerFn(listPositions);
  const fetchApps = useServerFn(listApplications);
  const fetchPlacements = useServerFn(listPlacements);
  const [clientFilter, setClientFilter] = useState<string | "all">("all");
  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: () => fetchPositions({ data: {} }),
  });
  const { data: apps = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchApps({ data: { stages: ["offered", "closed"] } }),
  });
  const { data: placements = [] } = useQuery({
    queryKey: ["placements"],
    queryFn: () => fetchPlacements({ data: {} }),
  });

  const placementsFor = (pid: string) => {
    const p = placements.filter((r) => r.position_id === pid);
    if (p.length > 0) return p.length;
    return apps.filter((a) => a.position_id === pid && (a.stage === "offered" || a.stage === "closed")).length;
  };
  const placementRowsFor = (pid: string) =>
    placements.filter((r) => r.position_id === pid);

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
  }, [positions, apps, placements]);

  const visible = clientFilter === "all" ? groups : groups.filter((g) => g.id === clientFilter);
  const totalClosed = groups.reduce((s, g) => s + g.positions.length, 0);
  const totalPlacements = groups.reduce((s, g) => s + g.placements, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Closed positions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalClosed} closed role{totalClosed === 1 ? "" : "s"} · {totalPlacements} placement{totalPlacements === 1 ? "" : "s"} · across {groups.length} client{groups.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-secondary/60 w-fit">
          <FilterChip active={clientFilter === "all"} onClick={() => setClientFilter("all")}>
            All ({totalClosed})
          </FilterChip>
          {groups.map((g) => (
            <FilterChip key={g.id} active={clientFilter === g.id} onClick={() => setClientFilter(g.id)}>
              {g.name} ({g.positions.length})
            </FilterChip>
          ))}
        </div>
      )}

      {isLoading && <CardListSkeleton rows={4} className="sm:grid-cols-2" />}
      {!isLoading && groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-14 text-center">
          <div className="mx-auto size-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary">
            <Trophy className="size-5" />
          </div>
          <div className="mt-3 font-medium text-sm">No closed positions yet</div>
          <div className="text-xs text-muted-foreground mt-1">They'll appear here once a candidate joins.</div>
        </div>
      )}

      <div className="space-y-8">
        {visible.map((g) => {
          return (
            <section key={g.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-7 rounded-md grid place-items-center text-[11px] font-semibold text-white shrink-0"
                  style={{ background: g.color ?? "hsl(var(--muted-foreground))" }}>
                  {initialsOf(g.name)}
                </div>
                <h2 className="font-semibold text-base tracking-tight truncate">{g.name}</h2>
                <span className="text-xs text-muted-foreground shrink-0">
                  · {g.positions.length} closed · {g.placements} placement{g.placements === 1 ? "" : "s"}
                </span>
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                {g.positions.map((p) => (
                  <PositionRow key={p.id} position={p} placementRows={placementRowsFor(p.id)} placementCount={placementsFor(p.id)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PositionRow({
  position,
  placementRows,
  placementCount,
}: {
  position: { id: string; title: string; location: string | null; openings: number; salary: string | null; updated_at?: string | null };
  placementRows: Array<{ id: string; candidate?: { id: string; name: string } | null; joining_date: string | null; ctc_display: string | null }>;
  placementCount: number;
}) {
  const seats = position.openings ?? 0;
  const filled = placementRows.length > 0 ? placementRows.length : placementCount;
  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/positions/$positionId" params={{ positionId: position.id }} className="text-sm font-semibold tracking-tight hover:text-primary transition-colors truncate">
              {position.title}
            </Link>
            <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-medium uppercase tracking-wider border border-success/20">Closed</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {position.location ?? "—"}
            </span>
            <span>Closed {fmtShortDate(position.updated_at ?? null)}</span>
            <span>{filled || seats}/{seats} seat{seats === 1 ? "" : "s"} filled</span>
            {position.salary && <span className="text-foreground/80">{position.salary}</span>}
          </div>
        </div>
        <Link to="/positions/$positionId" params={{ positionId: position.id }}
          className="size-8 grid place-items-center rounded-md border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors shrink-0">
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {placementRows.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Placed candidates</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {placementRows.map((pl) => {
              const name = pl.candidate?.name ?? "Candidate";
              const chip = (
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-secondary/40 border border-border hover:bg-secondary/70 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn("size-8 rounded-full grid place-items-center font-semibold text-[11px] shrink-0 bg-muted text-foreground border border-border")}>
                      {initialsOf(name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">Joined {fmtMonthYear(pl.joining_date)}</div>
                    </div>
                  </div>
                  {pl.ctc_display && (
                    <div className="text-xs font-medium text-primary shrink-0">{pl.ctc_display}</div>
                  )}
                </div>
              );
              return pl.candidate?.id ? (
                <Link key={pl.id} to="/candidates/$candidateId" params={{ candidateId: pl.candidate.id }}>
                  {chip}
                </Link>
              ) : (
                <div key={pl.id}>{chip}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md text-xs font-medium transition",
        active
          ? "bg-card shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}>
      {children}
    </button>
  );
}