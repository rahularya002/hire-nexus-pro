import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Calendar, Users, Loader2, Sparkles, UserCheck, UserX, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPositionById, assignPositionRecruiter, listAssignableRecruiters } from "@/lib/positions.functions";
import { daysSince, initialsOf } from "@/lib/display";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "sonner";

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
        </div>
      </div>

      <AssignmentCard positionId={positionId} assignedId={position.assigned_recruiter_id ?? null} canEdit={canAssign} />

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

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
        <h3 className="font-semibold tracking-tight">Candidate pipeline</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          The candidate pipeline, AI scout, and resume review will be wired to the database in Phase 2 (Candidates & Pipeline).
        </p>
      </div>
    </div>
  );
}

function AssignmentCard({ positionId, assignedId, canEdit }: { positionId: string; assignedId: string | null; canEdit: boolean }) {
  const qc = useQueryClient();
  const fetchRecruiters = useServerFn(listAssignableRecruiters);
  const assignFn = useServerFn(assignPositionRecruiter);
  const { data: recruiters = [] } = useQuery({
    queryKey: ["assignable-recruiters"],
    queryFn: () => fetchRecruiters(),
    enabled: canEdit,
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
