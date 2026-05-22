import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, StatusBadge } from "@/components/ui-bits";
import { listPositions } from "@/lib/positions.functions";
import { listApplications } from "@/lib/candidates.functions";
import { colorFor, initialsOf } from "@/lib/display";

export const Route = createFileRoute("/ongoing")({
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
    queryFn: () => fetchApps({ data: {} }),
  });

  const list = positions.filter((p) => p.status === "in_progress" || p.status === "interviews");
  const countFor = (pid: string) => apps.filter((a) => a.position_id === pid).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ongoing mandates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? "Loading…" : `${list.length} positions in active execution`}
        </p>
      </div>
      <div className="grid gap-3">
        {list.length === 0 && !isLoading && (
          <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
            No ongoing mandates yet.
          </div>
        )}
        {list.map((p) => {
          const client = p.client;
          return (
            <Link
              key={p.id}
              to="/positions/$positionId"
              params={{ positionId: p.id }}
              className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 rounded-lg grid place-items-center text-sm font-bold text-primary-foreground"
                    style={{ background: colorFor(client?.id, client?.color) }}
                  >
                    {initialsOf(client?.name)}
                  </div>
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{client?.name ?? "—"} · {p.location ?? "—"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={p.priority} />
                  <StatusBadge status={p.status} />
                  <span className="text-sm font-semibold tabular-nums">{countFor(p.id)} candidates</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}