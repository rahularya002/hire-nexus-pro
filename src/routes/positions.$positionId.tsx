import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Calendar, Users, Loader2, Sparkles, UserCheck, UserX, Check, Pencil, Send, X, Eye, Linkedin, Inbox } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PriorityBadge, StatusBadge, RecruitmentModelBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPositionById, assignPositionRecruiter, listAssignableRecruiters } from "@/lib/positions.functions";
import { daysSince, initialsOf } from "@/lib/display";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "sonner";
import { EditPositionDialog } from "@/components/edit-position-dialog";
import { EditCandidateDialog } from "@/components/edit-candidate-dialog";
import { EmptyState } from "@/components/empty-state";
import { CardListSkeleton } from "@/components/skeletons";
import {
  listApplications,
  updateApplicationStage,
  STAGE_LABEL,
  type ApplicationRow,
  type ApplicationStage,
} from "@/lib/candidates.functions";
import { formatSalary, cn } from "@/lib/utils";

export const Route = createFileRoute("/positions/$positionId")({
  component: PositionDetail,
});

function PositionDetail() {
  const { positionId } = Route.useParams();
  const navigate = useNavigate();
  const fetchPosition = useServerFn(getPositionById);
  const { roles } = useAuth();
  const canAssign = roles.includes("admin") || roles.includes("lead_recruiter");
  const canScout = canAssign || roles.includes("recruiter") || roles.includes("senior_recruiter");
  const canEditRequirement = canScout;
  const [editOpen, setEditOpen] = useState(false);
  const { data: position, isLoading } = useQuery({
    queryKey: ["position", positionId],
    queryFn: () => fetchPosition({ data: { id: positionId } }),
  });

  if (isLoading) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
        <Loader2 className="size-4 animate-spin" /> Loading position…
      </div>
    );
  }
  if (!position) {
    return (
      <div className="space-y-4">
        <Link to="/positions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All positions
        </Link>
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Position not found.
        </div>
      </div>
    );
  }

  const client = position.client;
  const days = daysSince(position.posted_at) ?? 0;

  return (
    <div className="space-y-6">
      {client ? (
        <Link to="/clients/$clientId" params={{ clientId: client.id }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {client.name}
        </Link>
      ) : (
        <Link to="/positions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All positions
        </Link>
      )}

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{position.title}</h1>
              <PriorityBadge priority={position.priority} />
              <StatusBadge status={position.status} />
              <RecruitmentModelBadge model={position.recruitment_model} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-3">
              {position.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {position.location}</span>}
              <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" /> Posted {days === 0 ? "today" : `${days}d ago`}</span>
              <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> {position.openings} opening{position.openings>1?"s":""}</span>
              {(position.experience || position.salary) && <span>{[position.experience, position.salary].filter(Boolean).join(" · ")}</span>}
            </div>
            {position.description && (
              <p className="text-sm text-foreground/80 mt-4 max-w-3xl leading-relaxed whitespace-pre-wrap">{position.description}</p>
            )}
            {position.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {position.skills.map((s) => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground font-medium">{s}</span>
                ))}
              </div>
            )}
          </div>
          {canEditRequirement && (
            <Button variant="outline" onClick={() => setEditOpen(true)} className="shrink-0">
              <Pencil className="size-4" /> Edit
            </Button>
          )}
        </div>
      </div>

      <AssignmentCard positionId={positionId} assignedId={position.assigned_recruiter_id ?? null} canEdit={canAssign} />

      {canEditRequirement && (
        <EditPositionDialog open={editOpen} onOpenChange={setEditOpen} position={position} />
      )}

      {canScout && (
        <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="size-10 rounded-lg bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Scout candidates with this JD</div>
              <p className="text-xs text-muted-foreground mt-0.5">Hand this requirement to AI Talent Scout — the JD is attached automatically.</p>
            </div>
          </div>
          <Button
            onClick={() => navigate({ to: "/scout", search: { positionId } })}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Sparkles className="size-4" /> Open in AI Scout
          </Button>
        </div>
      )}

      <CandidatePipeline positionId={positionId} canAct={canScout} />
    </div>
  );
}

function CandidatePipeline({ positionId, canAct }: { positionId: string; canAct: boolean }) {
  const qc = useQueryClient();
  const fetchApps = useServerFn(listApplications);
  const updateStage = useServerFn(updateApplicationStage);
  const [editCandidate, setEditCandidate] = useState<ApplicationRow["candidate"] | null>(null);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["position-apps", positionId],
    queryFn: () => fetchApps({ data: { positionId } }),
  });

  const m = useMutation({
    mutationFn: (vars: { id: string; stage: ApplicationStage }) => updateStage({ data: vars }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["position-apps", positionId] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      const msg =
        vars.stage === "shared_with_client" ? "Shared with client."
        : vars.stage === "recruiter_shortlist" ? "Marked as recruiter shortlist."
        : vars.stage === "client_rejected" ? "Marked rejected."
        : "Updated.";
      toast.success(msg);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not update candidate");
    },
  });

  const grouped = apps.reduce<Record<string, ApplicationRow[]>>((acc, a) => {
    (acc[a.stage] ||= []).push(a);
    return acc;
  }, {});

  const order: ApplicationStage[] = [
    "sourcing", "recruiter_shortlist", "shared_with_client", "client_shortlist",
    "interview_scheduled", "rounds", "offered", "on_hold", "client_rejected", "closed",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Candidate pipeline ({apps.length})</h2>
      </div>
      {isLoading ? (
        <CardListSkeleton rows={3} />
      ) : apps.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No candidates yet"
          description="Source candidates with AI Scout or add them from the database, then they'll appear here."
        />
      ) : (
        <div className="space-y-6">
          {order.filter((s) => grouped[s]?.length).map((stage) => (
            <div key={stage}>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                {STAGE_LABEL[stage]} · {grouped[stage].length}
              </div>
              <div className="grid gap-3">
                {grouped[stage].map((a) => (
                  <CandidateRow
                    key={a.id}
                    app={a}
                    canAct={canAct}
                    pending={m.isPending}
                    onShare={() => m.mutate({ id: a.id, stage: "shared_with_client" })}
                    onShortlist={() => m.mutate({ id: a.id, stage: "recruiter_shortlist" })}
                    onReject={() => m.mutate({ id: a.id, stage: "client_rejected" })}
                    onEdit={() => setEditCandidate(a.candidate ?? null)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editCandidate && (
        <EditCandidateDialog
          open={!!editCandidate}
          onOpenChange={(v) => { if (!v) setEditCandidate(null); }}
          candidate={editCandidate}
        />
      )}
    </div>
  );
}

function CandidateRow({
  app, canAct, pending, onShare, onShortlist, onReject, onEdit,
}: {
  app: ApplicationRow;
  canAct: boolean;
  pending: boolean;
  onShare: () => void;
  onShortlist: () => void;
  onReject: () => void;
  onEdit: () => void;
}) {
  const c = app.candidate;
  if (!c) return null;
  const initials = (c.name.match(/\b\w/g) ?? ["?"]).slice(0, 2).join("").toUpperCase();
  const canShare = app.stage === "sourcing" || app.stage === "recruiter_shortlist";
  const canShortlist = app.stage === "sourcing";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="size-10 shrink-0 rounded-lg bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate">{c.name}</h3>
                <StageBadge stage={app.stage} />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {[c.role, c.experience, c.location].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            {app.match_score != null && (
              <div className="text-right shrink-0">
                <div className="text-base font-semibold tabular-nums text-success">{app.match_score}%</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ai match</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
            <Mini label="Current" value={c.current_company ?? "—"} />
            <Mini label="Salary" value={formatSalary(c.salary ?? null) || "—"} />
            <Mini label="Email" value={c.email ?? "—"} />
            <Mini label="Phone" value={c.phone ?? "—"} />
          </div>

          {(c.skills ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {c.skills.slice(0, 8).map((s) => (
                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">{s}</span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {c.resume_url && (
              <a href={c.resume_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-card text-xs font-medium hover:bg-secondary">
                <Eye className="size-3.5" /> CV
              </a>
            )}
            {c.linkedin_url && (
              <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-[#0A66C2]/30 bg-[#0A66C2]/10 text-[#0A66C2] text-xs font-medium hover:bg-[#0A66C2]/20">
                <Linkedin className="size-3.5" /> LinkedIn
              </a>
            )}
            {canAct && (
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <Pencil className="size-3.5" /> Edit
              </button>
            )}
            <div className="flex-1" />
            {canAct && canShortlist && (
              <button
                onClick={onShortlist}
                disabled={pending}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card text-xs font-medium hover:bg-secondary disabled:opacity-50"
              >
                <Check className="size-3.5" /> Shortlist
              </button>
            )}
            {canAct && canShare && (
              <button
                onClick={onShare}
                disabled={pending}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="size-3.5" /> Share with client
              </button>
            )}
            {canAct && app.stage !== "client_rejected" && app.stage !== "closed" && (
              <button
                onClick={onReject}
                disabled={pending}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 disabled:opacity-50"
              >
                <X className="size-3.5" /> Reject
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-medium truncate">{value}</div>
    </div>
  );
}

function StageBadge({ stage }: { stage: ApplicationStage }) {
  const tone: Record<string, string> = {
    sourcing: "bg-muted text-muted-foreground",
    recruiter_shortlist: "bg-primary/10 text-primary",
    shared_with_client: "bg-warning/15 text-warning",
    client_shortlist: "bg-success/15 text-success",
    client_rejected: "bg-destructive/15 text-destructive",
    on_hold: "bg-warning/15 text-warning",
    interview_scheduled: "bg-purple/15 text-purple",
    rounds: "bg-purple/15 text-purple",
    offered: "bg-success/15 text-success",
    closed: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", tone[stage] ?? "bg-muted text-muted-foreground")}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

function AssignmentCard({ positionId, assignedId, canEdit }: { positionId: string; assignedId: string | null; canEdit: boolean }) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const fetchRecruiters = useServerFn(listAssignableRecruiters);
  const assignFn = useServerFn(assignPositionRecruiter);
  const { data: recruiters = [] } = useQuery({
    queryKey: ["assignable-recruiters"],
    queryFn: () => fetchRecruiters(),
    enabled: !!session,
  });
  const current = recruiters.find((r) => r.id === assignedId);
  const [pending, setPending] = useState<string>(assignedId ?? "");
  const [saving, setSaving] = useState<"assign" | "unassign" | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => { setPending(assignedId ?? ""); }, [assignedId]);
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(t);
  }, [justSaved]);

  async function save(targetId: string | null, mode: "assign" | "unassign") {
    setSaving(mode);
    try {
      await assignFn({ data: { id: positionId, assigned_recruiter_id: targetId } });
      const who = targetId ? recruiters.find((r) => r.id === targetId)?.name ?? "recruiter" : null;
      toast.success(who ? `Assigned to ${who}` : "Recruiter unassigned");
      setJustSaved(true);
      qc.invalidateQueries({ queryKey: ["position", positionId] });
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to assign recruiter");
    } finally {
      setSaving(null);
    }
  }

  const dirty = pending !== (assignedId ?? "");
  const pendingRecruiter = recruiters.find((r) => r.id === pending);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {current ? (
          <div className="size-10 rounded-full grid place-items-center text-xs font-bold bg-gradient-to-br from-primary to-purple text-primary-foreground shrink-0">
            {initialsOf(current.name)}
          </div>
        ) : (
          <div className="size-10 rounded-full grid place-items-center bg-secondary text-muted-foreground shrink-0">
            <UserX className="size-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
            Assigned recruiter
            {justSaved && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/25 font-medium">
                <Check className="size-3" /> Saved
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {current ? (
              <span><span className="text-foreground font-medium">{current.name}</span> · {current.role.replace(/_/g, " ")}</span>
            ) : (
              <span className="italic">No recruiter assigned yet.</span>
            )}
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex items-end gap-2 flex-wrap pt-1 border-t border-border">
          <div className="flex-1 min-w-[220px] pt-3">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Select recruiter</label>
            <Select value={pending} onValueChange={setPending} disabled={!!saving}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Choose a recruiter…" />
              </SelectTrigger>
              <SelectContent>
                {recruiters.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No recruiters available.</div>
                )}
                {recruiters.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} · <span className="text-muted-foreground">{r.role.replace(/_/g, " ")}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            onClick={() => save(pending || null, "assign")}
            disabled={!dirty || !pending || !!saving}
            className="h-9"
          >
            {saving === "assign" ? (
              <><Loader2 className="size-4 animate-spin" /> Assigning…</>
            ) : (
              <><UserCheck className="size-4" /> {current ? "Reassign" : "Assign"}{pendingRecruiter ? ` to ${pendingRecruiter.name.split(" ")[0]}` : ""}</>
            )}
          </Button>
          {current && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => save(null, "unassign")}
              disabled={!!saving}
              className="h-9 text-muted-foreground"
            >
              {saving === "unassign" ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />} Unassign
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
