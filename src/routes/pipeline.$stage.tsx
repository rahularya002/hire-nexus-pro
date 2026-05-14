import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { positions, clients, PIPELINE_STAGES, type CandidateStage } from "@/lib/mock-data";
import { detailFor } from "@/lib/ops/store";
import {
  ArrowLeft, Check, X, Send, Database, FileText, MapPin, Briefcase, Building2,
  Clock, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  clientId: z.string().optional(),
  positionId: z.string().optional(),
});

export const Route = createFileRoute("/pipeline/$stage")({
  validateSearch: searchSchema,
  component: () => <AppShell><Drilldown /></AppShell>,
});

type CandidateAction = "select" | "reject" | "share" | "return";

function Drilldown() {
  const { stage } = Route.useParams();
  const { clientId, positionId } = Route.useSearch();
  const navigate = useNavigate();
  const [actions, setActions] = useState<Record<string, CandidateAction>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const stageTyped = stage as CandidateStage;
  if (!PIPELINE_STAGES.includes(stageTyped)) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Unknown stage: {stage}</div>;
  }

  const candidates = positions
    .filter((p) => !clientId || p.clientId === clientId)
    .filter((p) => !positionId || p.id === positionId)
    .flatMap((p) =>
      p.candidates
        .filter((c) => c.stage === stageTyped)
        .map((c) => ({
          ...c,
          posTitle: p.title,
          posId: p.id,
          clientName: clients.find((x) => x.id === p.clientId)!.name,
          clientId: p.clientId,
        }))
    );

  const client = clientId ? clients.find((c) => c.id === clientId) : undefined;
  const position = positionId ? positions.find((p) => p.id === positionId) : undefined;

  const apply = (id: string, action: CandidateAction) => {
    setActions((prev) => ({ ...prev, [id]: action }));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <button
            onClick={() => navigate({ to: "/pipeline" })}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-3" /> Back to pipeline
          </button>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{stageTyped}</h1>
          <div className="text-sm text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
            <span>{candidates.length} candidates</span>
            {client && <><span>·</span><span>{client.name}</span></>}
            {position && <><span>·</span><span>{position.title}</span></>}
          </div>
        </div>
        <Link to="/database" className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary">
          <Database className="size-4" /> Database
        </Link>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No candidates currently at <strong className="text-foreground">{stageTyped}</strong> for this filter.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {candidates.map((c) => {
            const d = detailFor(c);
            const action = actions[c.id];
            const isOpen = openId === c.id;
            return (
              <div key={c.id} className={cn(
                "rounded-xl border bg-card transition",
                action === "select" && "border-success/40 bg-success/5",
                action === "reject" && "border-destructive/30 bg-destructive/5 opacity-70",
                action === "share" && "border-primary/40 bg-primary/5",
                action === "return" && "border-warning/40 bg-warning/5",
                !action && "border-border"
              )}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="size-11 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center font-semibold shrink-0">
                      {c.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{c.posTitle} · {c.clientName}</div>
                        </div>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/10 text-success text-xs font-semibold shrink-0">
                          <Sparkles className="size-3" />{d.aiMatch}%
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                        <Field icon={Briefcase} label="Experience" value={d.experience} />
                        <Field icon={Building2} label="Prev org" value={d.prevOrg} />
                        <Field icon={MapPin} label="Location" value={d.location} />
                        <Field icon={Clock} label="Notice" value={d.noticePeriod} />
                        <Field icon={FileText} label="Salary" value={d.salary} />
                        <Field icon={Sparkles} label="Source" value={d.source} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <button
                      onClick={() => setOpenId(isOpen ? null : c.id)}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      {isOpen ? "Hide resume preview" : "Resume preview"}
                    </button>
                    {isOpen && (
                      <div className="mt-2 rounded-md bg-secondary/40 border border-border p-3 text-xs text-muted-foreground leading-relaxed">
                        <div className="font-medium text-foreground mb-1.5 text-[11px] uppercase tracking-wider">Auto-generated summary</div>
                        {d.resumeSummary}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 py-2.5 border-t border-border flex items-center justify-between gap-2 flex-wrap bg-secondary/20">
                  {action ? (
                    <div className="text-[11px] font-medium">
                      {action === "select" && <span className="text-success">✓ Selected — moves to next stage</span>}
                      {action === "reject" && <span className="text-destructive">✗ Rejected — returned to database</span>}
                      {action === "share" && <span className="text-primary">→ Shared with {c.clientName}</span>}
                      {action === "return" && <span className="text-warning">↩ Returned to database</span>}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground">Take action</div>
                  )}
                  <div className="flex items-center gap-1">
                    <ActionBtn icon={Check} label="Select" tone="success" onClick={() => apply(c.id, "select")} />
                    <ActionBtn icon={Send} label="Share" tone="primary" onClick={() => apply(c.id, "share")} />
                    <ActionBtn icon={Database} label="Return to DB" tone="warning" onClick={() => apply(c.id, "return")} />
                    <ActionBtn icon={X} label="Reject" tone="destructive" onClick={() => apply(c.id, "reject")} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="size-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground/80">{label}:</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, tone, onClick }: { icon: React.ElementType; label: string; tone: "success" | "primary" | "warning" | "destructive"; onClick: () => void }) {
  const cls = {
    success: "hover:bg-success/15 hover:text-success",
    primary: "hover:bg-primary/15 hover:text-primary",
    warning: "hover:bg-warning/15 hover:text-warning",
    destructive: "hover:bg-destructive/10 hover:text-destructive",
  }[tone];
  return (
    <button onClick={onClick} title={label} className={cn("h-8 px-2.5 rounded-md inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition", cls)}>
      <Icon className="size-3.5" /> {label}
    </button>
  );
}