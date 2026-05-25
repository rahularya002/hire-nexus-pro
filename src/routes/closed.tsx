import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CardListSkeleton } from "@/components/skeletons";
import { listPositions } from "@/lib/positions.functions";
import { listApplications } from "@/lib/candidates.functions";
import { initialsOf } from "@/lib/display";

export const Route = createFileRoute("/closed")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const fetchPositions = useServerFn(listPositions);
  const fetchApps = useServerFn(listApplications);
  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: () => fetchPositions({ data: {} }),
  });
  const { data: apps = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchApps({ data: { stages: ["offered", "closed"] } }),
  });

  const list = positions.filter((p) => p.status === "closed");
  const placementsFor = (pid: string) =>
    apps.filter((a) => a.position_id === pid && (a.stage === "offered" || a.stage === "closed")).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Closed positions</h1>
        <p className="text-sm text-muted-foreground mt-1">Successful placements and historical mandates</p>
      </div>
      {isLoading && <CardListSkeleton rows={4} className="sm:grid-cols-2" />}
      {!isLoading && list.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
          No closed positions yet.
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {list.map((p) => {
          const placements = placementsFor(p.id);
          return (
            <div key={p.id} className="rounded-xl border border-border bg-gradient-to-br from-success/5 to-card p-5">
              <div className="flex items-center gap-2 text-success text-xs font-medium">
                <Trophy className="size-4" /> Successfully closed
              </div>
              <div className="font-semibold mt-2">{p.title}</div>
              <div className="text-xs text-muted-foreground">
                {p.client?.name ?? initialsOf(p.client?.name)} · {p.location ?? "—"}
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
    </div>
  );
}