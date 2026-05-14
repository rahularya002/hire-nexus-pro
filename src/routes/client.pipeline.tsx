import { createFileRoute, Link } from "@tanstack/react-router";
import { Workflow } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { clientPositions, recruiterFor } from "@/lib/client-data";

export const Route = createFileRoute("/client/pipeline")({
  component: () => <ClientShell><Page /></ClientShell>,
});

const COLUMNS = [
  { id: "pending",     label: "Shared",      tone: "border-warning/40 bg-warning/5" },
  { id: "shortlisted", label: "Shortlisted", tone: "border-purple/40 bg-purple/5" },
  { id: "interview",   label: "Interview",   tone: "border-info/40 bg-info/5" },
  { id: "rejected",    label: "Rejected",    tone: "border-destructive/30 bg-destructive/5" },
] as const;

function Page() {
  const all = clientPositions.flatMap((p) =>
    p.candidates.map((c) => ({ ...c, positionId: p.id, positionTitle: p.title, recruiter: recruiterFor(p.recruiterId).name }))
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Live candidate flow</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <Workflow className="size-5 text-primary" /> Pipeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">All candidates across your requirements, grouped by stage.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const items = all.filter((c) => c.status === col.id);
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
                {items.map((c) => (
                  <Link key={c.id} to="/client/positions/$positionId" params={{ positionId: c.positionId }}
                    className="block rounded-lg border border-border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition">
                    <div className="flex items-start gap-2">
                      <div className="size-8 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-[11px] font-semibold shrink-0">
                        {c.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{c.role}</div>
                      </div>
                      <div className="text-[11px] font-semibold text-success tabular-nums">{c.matchScore}%</div>
                    </div>
                    <div className="mt-2 text-[10px] text-muted-foreground truncate">
                      {c.positionTitle} · {c.recruiter}
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