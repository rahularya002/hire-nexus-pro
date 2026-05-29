import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, MapPin, Check, X, Calendar, Eye, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ClientShell, ClientStatusBadge } from "@/components/client-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { CardListSkeleton } from "@/components/skeletons";
import { getPositionById } from "@/lib/positions.functions";
import {
  listApplications, updateApplicationStage,
  CLIENT_VISIBLE_STAGES, STAGE_LABEL, type ApplicationRow, type ApplicationStage,
} from "@/lib/candidates.functions";

export const Route = createFileRoute("/client/positions/$positionId")({
  component: () => <ClientShell><Detail /></ClientShell>,
  errorComponent: ({ error, reset }) => (
    <ClientShell>
      <div className="space-y-4 max-w-xl">
        <Link to="/client/positions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All positions
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
          <div className="text-sm font-semibold text-destructive">Couldn't load this position</div>
          <p className="text-xs text-destructive/80 mt-1">{error?.message ?? "Unknown error"}</p>
          <button onClick={() => reset()} className="mt-4 h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium">Try again</button>
        </div>
      </div>
    </ClientShell>
  ),
});

function Detail() {
  const { positionId } = Route.useParams();
  const qc = useQueryClient();
  const fetchPos = useServerFn(getPositionById);
  const fetchApps = useServerFn(listApplications);
  const updateStage = useServerFn(updateApplicationStage);

  const posQ = useQuery({ queryKey: ["client-position", positionId], queryFn: () => fetchPos({ data: { id: positionId } }) });
  const appsQ = useQuery({
    queryKey: ["client-position-apps", positionId],
    queryFn: () => fetchApps({ data: { positionId, stages: CLIENT_VISIBLE_STAGES } }),
  });

  if (posQ.error) {
    return (
      <div className="space-y-4 max-w-xl">
        <Link to="/client/positions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All positions
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
          <div className="text-sm font-semibold text-destructive">Couldn't load this position</div>
          <p className="text-xs text-destructive/80 mt-1">{posQ.error instanceof Error ? posQ.error.message : "Unknown error"}</p>
        </div>
      </div>
    );
  }

  const m = useMutation({
    mutationFn: (vars: { id: string; stage: ApplicationStage }) => updateStage({ data: vars }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["client-position-apps", positionId] });
      qc.invalidateQueries({ queryKey: ["client-applications-all"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      const msg =
        vars.stage === "client_rejected" ? "Candidate rejected. The recruiter has been notified."
        : vars.stage === "client_shortlist" ? "Candidate shortlisted."
        : vars.stage === "interview_scheduled" ? "Interview requested. The recruiter will reach out to confirm a time."
        : "Updated.";
      toast.success(msg);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not update candidate");
    },
  });

  if (posQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
        <CardListSkeleton rows={3} />
      </div>
    );
  }
  const initial = posQ.data;
  if (!initial) {
    return (
      <div className="space-y-4">
        <Link to="/client/positions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All positions</Link>
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Position not found.</div>
      </div>
    );
  }
  const apps = appsQ.data ?? [];

  return (
    <div className="space-y-6">
      <Link to="/client/positions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All positions
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{initial.title}</h1>
              <ClientStatusBadge status={initial.status} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-3">
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{initial.location ?? "—"}</span>
              <span>{initial.experience} · {initial.salary}</span>
              <span>{initial.openings} opening{initial.openings>1?"s":""}</span>
              <span>Posted {Math.max(0, Math.floor((Date.now() - new Date(initial.posted_at).getTime()) / 86_400_000))}d ago</span>
            </div>
            {initial.description && <p className="text-sm text-foreground/80 mt-4 max-w-3xl leading-relaxed">{initial.description}</p>}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {(initial.skills ?? []).map(s => <span key={s} className="text-xs px-2.5 py-1 rounded-md bg-secondary font-medium">{s}</span>)}
            </div>
          </div>
          <Link
            to="/client/messages"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary">
            <MessageSquare className="size-4" /> Message recruiter
          </Link>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-3">Candidates shared with you ({apps.length})</div>
        {appsQ.isLoading ? (
          <CardListSkeleton rows={3} />
        ) : apps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">No candidates have been shared with you yet.</div>
        ) : (
          <CandidateList apps={apps} onUpdate={(id, stage) => m.mutate({ id, stage })} pending={m.isPending} />
        )}
      </div>
    </div>
  );
}

function CandidateList({ apps, onUpdate, pending }: { apps: ApplicationRow[]; onUpdate: (id: string, stage: ApplicationStage) => void; pending: boolean }) {
  return (
    <div className="grid gap-3">
      {apps.map(a => {
        const c = a.candidate;
        if (!c) return null;
        const initials = (c.name.match(/\b\w/g) ?? ["?"]).slice(0, 2).join("").toUpperCase();
        return (
        <div key={a.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <div className="size-12 shrink-0 rounded-xl bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-sm font-semibold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{c.name}</h3>
                    <StageBadge stage={a.stage} />
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">{c.role ?? "—"} · {c.experience ?? "—"} · {c.location ?? "—"}</div>
                </div>
                {a.match_score != null && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums text-success">{a.match_score}%</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">match</div>
                    </div>
                  </div>
                )}
              </div>

              {c.notes && <p className="text-sm text-foreground/80 mt-3 leading-relaxed">{c.notes}</p>}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <Mini label="Current" value={c.current_company ?? "—"} />
                <Mini label="Email" value={c.email ?? "—"} />
                <Mini label="Phone" value={c.phone ?? "—"} />
                <Mini label="Location" value={c.location ?? "—"} />
              </div>

              <div className="flex flex-wrap gap-1.5 mt-4">
                {(c.skills ?? []).map(s => <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-secondary">{s}</span>)}
              </div>

              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border flex-wrap">
                {c.resume_url && (
                  <a href={c.resume_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary">
                    <Eye className="size-4" /> View CV
                  </a>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => onUpdate(a.id, "client_rejected")}
                  disabled={pending || a.stage === "client_rejected" || a.stage === "closed"}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 disabled:opacity-50">
                  <X className="size-4" /> Reject
                </button>
                <button
                  onClick={() => onUpdate(a.id, "client_shortlist")}
                  disabled={pending || a.stage === "client_shortlist" || a.stage === "interview_scheduled" || a.stage === "rounds" || a.stage === "offered" || a.stage === "client_rejected"}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-success text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  <Check className="size-4" /> Shortlist
                </button>
                <button
                  onClick={() => onUpdate(a.id, "interview_scheduled")}
                  disabled={pending || a.stage === "client_rejected" || a.stage === "interview_scheduled"}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                  <Calendar className="size-4" /> Schedule interview
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}

function StageBadge({ stage }: { stage: ApplicationStage }) {
  const tone: Record<string, string> = {
    shared_with_client: "bg-warning/15 text-warning",
    client_shortlist: "bg-purple/15 text-purple",
    client_rejected: "bg-destructive/15 text-destructive",
    interview_scheduled: "bg-info/15 text-info",
    rounds: "bg-info/15 text-info",
    offered: "bg-success/15 text-success",
    closed: "bg-destructive/10 text-destructive",
  };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium", tone[stage] ?? "bg-secondary")}>{STAGE_LABEL[stage]}</span>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate" title={value}>{value}</div>
    </div>
  );
}

