import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trophy, ChevronRight } from "lucide-react";
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
  const topClient = groups[0]?.name ?? "—";

  return (
    <div className="space-y-10">
      {/* Header + stat strip */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-1.5 w-8 bg-primary rounded-full" />
            <span className="text-primary text-[10px] font-bold uppercase tracking-[0.2em]">Historical Archive</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Closed positions</h1>
          <p className="text-muted-foreground mt-2 max-w-md text-sm">
            Successful placements and historical mandates across every client you've delivered for.
          </p>
        </div>
        <div className="flex gap-10">
          <StatBlock label="Closed roles" value={totalClosed.toString()} muted />
          <StatBlock label="Placements" value={totalPlacements.toString()} />
          <StatBlock label="Top client" value={topClient} muted title />
        </div>
      </div>

      {/* Filter chips */}
      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={clientFilter === "all"} onClick={() => setClientFilter("all")}>
            All clients <span className="ml-1.5 opacity-60 text-xs">{totalClosed}</span>
          </FilterChip>
          {groups.map((g) => (
            <FilterChip key={g.id} active={clientFilter === g.id} onClick={() => setClientFilter(g.id)}>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: g.color ?? "hsl(var(--muted-foreground))" }} />
                {g.name}
                <span className="ml-1 opacity-60 text-xs">{g.positions.length}</span>
              </span>
            </FilterChip>
          ))}
        </div>
      )}

      {isLoading && <CardListSkeleton rows={4} className="sm:grid-cols-2" />}
      {!isLoading && groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-16 text-center">
          <div className="mx-auto size-12 rounded-2xl bg-primary/10 border border-primary/20 grid place-items-center text-primary">
            <Trophy className="size-6" />
          </div>
          <div className="mt-4 font-medium">No wins yet</div>
          <div className="text-sm text-muted-foreground mt-1">Closed positions will appear here once a candidate joins.</div>
        </div>
      )}

      {/* Client sections */}
      <div className="space-y-10">
        {visible.map((g) => {
          const featured = g.positions[0];
          const rest = g.positions.slice(1);
          return (
            <section key={g.id} className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="size-8 rounded-lg grid place-items-center text-xs font-semibold text-white shrink-0 shadow-lg"
                  style={{ background: g.color ?? "hsl(var(--muted-foreground))" }}>
                  {initialsOf(g.name)}
                </div>
                <h2 className="font-bold text-xl tracking-tight truncate">{g.name}</h2>
                <span className="text-xs text-muted-foreground shrink-0">
                  {g.positions.length} closed · {g.placements} placement{g.placements === 1 ? "" : "s"}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
              </div>

              {featured && <FeaturedCard position={featured} placementRows={placementRowsFor(featured.id)} />}

              {rest.length > 0 && (
                <div className="space-y-3">
                  {rest.map((p) => (
                    <CompactRow key={p.id} position={p} placements={placementsFor(p.id)} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StatBlock({ label, value, muted = false, title = false }: { label: string; value: string; muted?: boolean; title?: boolean }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground mb-1.5">{label}</div>
      <div className={cn(
        "font-bold tracking-tighter",
        title ? "text-lg truncate max-w-[140px]" : "text-3xl",
        muted ? "text-foreground" : "text-primary",
      )}>{value}</div>
    </div>
  );
}

function FeaturedCard({
  position,
  placementRows,
}: {
  position: { id: string; title: string; location: string | null; openings: number; salary: string | null; updated_at?: string | null };
  placementRows: Array<{ id: string; candidate?: { id: string; name: string } | null; joining_date: string | null; ctc_display: string | null }>;
}) {
  const seats = position.openings ?? 0;
  const filled = Math.max(placementRows.length, 0);
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-border">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link to="/positions/$positionId" params={{ positionId: position.id }} className="text-xl font-bold tracking-tight hover:text-primary transition-colors truncate">
              {position.title}
            </Link>
            <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-bold uppercase tracking-widest border border-success/20">Completed</span>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground text-sm flex-wrap">
            <span className="inline-flex items-center gap-2">
              <span className="size-1 rounded-full bg-primary" />
              {position.location ?? "Location not set"}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-1 rounded-full bg-primary" />
              Closed {fmtShortDate(position.updated_at ?? null)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-10 shrink-0">
          <div className="text-left lg:text-right">
            <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">Seats filled</div>
            <div className="font-bold text-2xl tracking-tighter">
              {filled || seats} <span className="text-muted-foreground font-medium text-lg">/ {seats}</span>
            </div>
          </div>
          {position.salary && (
            <div className="text-left lg:text-right">
              <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">CTC band</div>
              <div className="font-bold text-lg tracking-tight text-primary">{position.salary}</div>
            </div>
          )}
        </div>
      </div>

      {placementRows.length > 0 && (
        <div className="p-6">
          <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground mb-4">Retained talent</div>
          <div className="grid md:grid-cols-2 gap-3">
            {placementRows.map((pl, i) => {
              const name = pl.candidate?.name ?? "Candidate";
              const chip = (
                <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-muted/20 border border-border hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "size-11 rounded-lg grid place-items-center font-bold text-sm shrink-0 border",
                      i === 0 ? "bg-primary text-primary-foreground border-primary/40" : "bg-muted text-foreground border-border",
                    )}>
                      {initialsOf(name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{name}</div>
                      <div className="text-xs text-muted-foreground truncate">Joined {fmtMonthYear(pl.joining_date)}</div>
                    </div>
                  </div>
                  {pl.ctc_display && (
                    <div className="text-sm font-semibold text-primary shrink-0">{pl.ctc_display}</div>
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

function CompactRow({
  position,
  placements,
}: {
  position: { id: string; title: string; location: string | null; updated_at?: string | null };
  placements: number;
}) {
  return (
    <Link to="/positions/$positionId" params={{ positionId: position.id }}
      className="group flex items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="min-w-0">
        <div className="font-bold tracking-tight group-hover:text-primary transition-colors truncate">{position.title}</div>
        <div className="text-sm text-muted-foreground truncate">
          {placements} placement{placements === 1 ? "" : "s"} · Closed {fmtShortDate(position.updated_at ?? null)}
          {position.location ? <> · {position.location}</> : null}
        </div>
      </div>
      <div className="size-11 grid place-items-center rounded-xl border border-border text-muted-foreground group-hover:border-primary/50 group-hover:text-primary transition-colors shrink-0">
        <ChevronRight className="size-5" />
      </div>
    </Link>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "text-xs px-4 py-1.5 rounded-lg border transition",
        active
          ? "bg-primary/15 text-primary border-primary/30"
          : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}>
      {children}
    </button>
  );
}