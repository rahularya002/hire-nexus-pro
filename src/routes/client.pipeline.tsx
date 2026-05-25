import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Workflow } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import {
  CLIENT_VISIBLE_STAGES,
  STAGE_LABEL,
  listApplications,
  type ApplicationStage,
} from "@/lib/candidates.functions";
import { initialsOf } from "@/lib/display";

export const Route = createFileRoute("/client/pipeline")({
  component: () => <ClientShell><Page /></ClientShell>,
});

const COLUMNS: { id: ApplicationStage; label: string; tone: string }[] = [
  { id: "shared_with_client",   label: "Shared",      tone: "border-warning/40 bg-warning/5" },
  { id: "client_shortlist",     label: "Shortlisted", tone: "border-purple/40 bg-purple/5" },
  { id: "interview_scheduled",  label: "Interview",   tone: "border-info/40 bg-info/5" },
  { id: "rounds",               label: "Rounds",      tone: "border-info/40 bg-info/5" },
  { id: "offered",              label: "Offered",     tone: "border-success/40 bg-success/5" },
  { id: "closed",               label: "Closed",      tone: "border-destructive/30 bg-destructive/5" },
];

function Page() {
  const fetchApps = useServerFn(listApplications);
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["client-applications"],
    queryFn: () => fetchApps({ data: { stages: CLIENT_VISIBLE_STAGES } }),
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Live candidate flow</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <Workflow className="size-5 text-primary" /> Pipeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? "\u00A0" : `${apps.length} candidates shared with you, grouped by stage.`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {COLUMNS.map((col) => {
          const items = apps.filter((a) => a.stage === col.id);
          return (
            <div key={col.id} className={`rounded-xl border ${col.tone} p-3`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="text-xs font-semibold uppercase tracking-wider">{col.label}</div>
                <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && (
                  <div className="rounded-md border border-dashed border-border bg-card/40 px-3 py-6 text-center text-[11px] text-muted-foreground">
                    Nothing here yet
                  </div>
                )}
                {items.map((a) => (
                  <Link
                    key={a.id}
                    to="/client/positions/$positionId"
                    params={{ positionId: a.position_id }}
                    className="block rounded-lg border border-border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition"
                  >
                    <div className="flex items-start gap-2">
                      <div className="size-8 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-[11px] font-semibold shrink-0">
                        {initialsOf(a.candidate?.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{a.candidate?.name ?? "Unknown"}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{a.candidate?.role ?? "—"}</div>
                      </div>
                      {a.match_score != null && (
                        <div className="text-[11px] font-semibold text-success tabular-nums">{a.match_score}%</div>
                      )}
                    </div>
                    <div className="mt-2 text-[10px] text-muted-foreground truncate">
                      {a.position?.title} · {STAGE_LABEL[a.stage]}
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