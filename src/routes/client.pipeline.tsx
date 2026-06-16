import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Workflow, ChevronRight, Briefcase } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import {
  CLIENT_VISIBLE_STAGES,
  listApplications,
} from "@/lib/candidates.functions";
import { listPositions } from "@/lib/positions.functions";

export const Route = createFileRoute("/client/pipeline")({
  component: () => <ClientShell><Page /></ClientShell>,
});

function Page() {
  const fetchApps = useServerFn(listApplications);
  const fetchPositions = useServerFn(listPositions);
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["client-applications"],
    queryFn: () => fetchApps({ data: { stages: CLIENT_VISIBLE_STAGES } }),
  });
  const { data: positions = [] } = useQuery({
    queryKey: ["client-positions"],
    queryFn: () => fetchPositions({ data: {} }),
  });

  const open = positions.filter((p) => p.status !== "closed");
  const byPos = new Map<string, typeof apps>();
  for (const a of apps) {
    const arr = byPos.get(a.position_id) ?? [];
    arr.push(a);
    byPos.set(a.position_id, arr);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Open roles · candidate flow</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <Workflow className="size-5 text-primary" /> Pipeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? "\u00A0" : `${open.length} open position${open.length === 1 ? "" : "s"} · click a role to see candidates by stage.`}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {open.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No open positions yet.</div>
        )}
        {open.map((p) => {
          const items = byPos.get(p.id) ?? [];
          const shared = items.filter((a) => a.stage === "shared_with_client").length;
          const shortlisted = items.filter((a) => a.stage === "client_shortlist").length;
          const interview = items.filter((a) => a.stage === "interview_scheduled" || a.stage === "rounds").length;
          const offered = items.filter((a) => a.stage === "offered").length;
          return (
            <Link
              key={p.id}
              to="/client/positions/$positionId"
              params={{ positionId: p.id }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition"
            >
              <div className="size-9 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
                <Briefcase className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{p.title}</div>
                <div className="text-[11px] text-muted-foreground truncate">{p.location ?? "—"} · {items.length} candidate{items.length === 1 ? "" : "s"}</div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px]">
                <Pill tone="warning" label="Shared" value={shared} />
                <Pill tone="purple" label="Shortlist" value={shortlisted} />
                <Pill tone="info" label="Interview" value={interview} />
                <Pill tone="success" label="Offered" value={offered} />
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Pill({ tone, label, value }: { tone: "warning" | "purple" | "info" | "success"; label: string; value: number }) {
  const toneCls =
    tone === "warning" ? "bg-warning/15 text-warning"
    : tone === "purple" ? "bg-purple/15 text-purple"
    : tone === "info" ? "bg-info/15 text-info"
    : "bg-success/15 text-success";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${toneCls}`}>
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}