import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, MapPin, Check, X, Calendar, Eye, MessageSquare, Linkedin, Sparkles, Plus, Trash2, Pencil, Pencil as PencilIcon, Pause, Play,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn, formatSalary } from "@/lib/utils";
import { ClientShell, ClientStatusBadge } from "@/components/client-shell";
import { RecruitmentModelBadge } from "@/components/ui-bits";
import { Skeleton } from "@/components/ui/skeleton";
import { CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { Inbox } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getPositionById } from "@/lib/positions.functions";
import {
  listApplications, updateApplicationStage,
  CLIENT_VISIBLE_STAGES, STAGE_LABEL, type ApplicationRow, type ApplicationStage,
} from "@/lib/candidates.functions";
import {
  requestClientInterview,
  INTERVIEW_KINDS,
  INTERVIEW_KIND_LABEL,
  type InterviewKind,
  INTERVIEW_PROVIDERS,
  INTERVIEW_PROVIDER_LABEL,
  type InterviewProvider,
} from "@/lib/interviews.functions";
import { listClientMembers } from "@/lib/client-team.functions";
import { EditPositionDialog } from "@/components/edit-position-dialog";
import { EditCandidateDialog } from "@/components/edit-candidate-dialog";
import { GoogleCalendarCard } from "@/components/google-calendar-card";
import { getMyGoogleConnection } from "@/lib/google-calendar.functions";
import { AlertCircle } from "lucide-react";

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
  const requestInterview = useServerFn(requestClientInterview);
  const fetchGoogle = useServerFn(getMyGoogleConnection);
  const [scheduleFor, setScheduleFor] = useState<ApplicationRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const posQ = useQuery({ queryKey: ["client-position", positionId], queryFn: () => fetchPos({ data: { id: positionId } }) });
  const appsQ = useQuery({
    queryKey: ["client-position-apps", positionId],
    queryFn: () => fetchApps({ data: { positionId, stages: CLIENT_VISIBLE_STAGES } }),
  });
  const googleQ = useQuery({
    queryKey: ["google-connection"],
    queryFn: () => fetchGoogle(),
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
        : vars.stage === "on_hold" ? "Candidate put on hold."
        : vars.stage === "shared_with_client" ? "Candidate resumed for review."
        : "Updated.";
      toast.success(msg);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not update candidate");
    },
  });

  const scheduleM = useMutation({
    mutationFn: (vars: { application_id: string; scheduled_at: string; rounds: RoundDraft[]; provider: InterviewProvider; location: string | null }) =>
      requestInterview({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-position-apps", positionId] });
      qc.invalidateQueries({ queryKey: ["client-applications-all"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["interviews"] });
      toast.success("Interview requested. The recruiter will confirm shortly.");
      setScheduleFor(null);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not request interview");
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
              <RecruitmentModelBadge model={initial.recruitment_model} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-3">
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{initial.location ?? "—"}</span>
              <span>{[initial.experience, formatSalary(initial.salary)].filter((v) => v && v !== "—").join(" · ") || "—"}</span>
              <span>{initial.openings} opening{initial.openings>1?"s":""}</span>
              <span>Posted {Math.max(0, Math.floor((Date.now() - new Date(initial.posted_at).getTime()) / 86_400_000))}d ago</span>
            </div>
            {initial.description && <p className="text-sm text-foreground/80 mt-4 max-w-3xl leading-relaxed">{initial.description}</p>}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {(initial.skills ?? []).map(s => <span key={s} className="text-xs px-2.5 py-1 rounded-md bg-secondary font-medium">{s}</span>)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setEditOpen(true)} className="h-10">
              <Pencil className="size-4" /> Edit
            </Button>
            {(initial.recruitment_model === "self" || initial.recruitment_model === "hybrid") && (
              <Link
                to="/client/scout"
                search={{ positionId: initial.id }}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                <Sparkles className="size-4" /> Scout candidates
              </Link>
            )}
            <Link
              to="/client/messages"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary">
              <MessageSquare className="size-4" /> Message recruiter
            </Link>
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-3">Candidates shared with you ({apps.length})</div>
        {!googleQ.isLoading && !googleQ.data?.connected && (
          <div className="mb-3 rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-start gap-3 flex-wrap">
            <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Connect Google Calendar to schedule interviews</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Video interviews need a connected Google account so we can auto-create a Meet link and email the candidate an invite.
              </p>
            </div>
            <Link
              to="/client/settings"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
            >
              <Calendar className="size-3.5" /> Connect
            </Link>
          </div>
        )}
        {appsQ.isLoading ? (
          <CardListSkeleton rows={3} />
        ) : apps.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No candidates yet"
            description="Your recruiter is sourcing profiles. Shared candidates will appear here for your review."
          />
        ) : (
          <CandidateList apps={apps} onUpdate={(id, stage) => m.mutate({ id, stage })} pending={m.isPending} onSchedule={(a) => setScheduleFor(a)} />
        )}
      </div>

      <ScheduleInterviewDialog
        app={scheduleFor}
        googleConnected={!!googleQ.data?.connected}
        onClose={() => setScheduleFor(null)}
        onSubmit={(scheduled_at, rounds, provider, location) =>
          scheduleFor && scheduleM.mutate({ application_id: scheduleFor.id, scheduled_at, rounds, provider, location })
        }
        pending={scheduleM.isPending}
      />

      <EditPositionDialog open={editOpen} onOpenChange={setEditOpen} position={initial} />
    </div>
  );
}

function CandidateList({ apps, onUpdate, pending, onSchedule }: { apps: ApplicationRow[]; onUpdate: (id: string, stage: ApplicationStage) => void; pending: boolean; onSchedule: (a: ApplicationRow) => void }) {
  const [editFor, setEditFor] = useState<ApplicationRow["candidate"] | null>(null);
  return (
    <div className="grid gap-3">
      {apps.map(a => {
        const c = a.candidate;
        if (!c) return null;
        const initials = (c.name.match(/\b\w/g) ?? ["?"]).slice(0, 2).join("").toUpperCase();
        const canSchedule =
          a.stage === "client_shortlist" ||
          a.stage === "interview_scheduled" ||
          a.stage === "rounds" ||
          a.stage === "offered";
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
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditFor(c)}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary"
                    title="Edit candidate details"
                  >
                    <PencilIcon className="size-3.5" /> Edit
                  </button>
                  {a.match_score != null && (
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums text-success">{a.match_score}%</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ai match</div>
                    </div>
                  )}
                </div>
              </div>

              {c.notes && <p className="text-sm text-foreground/80 mt-3 leading-relaxed">{c.notes}</p>}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <Mini label="Current Org" value={c.current_company ?? "—"} />
                <Mini label="Experience" value={c.experience ?? "—"} />
                <Mini label="Salary" value={formatSalary((c as unknown as { salary?: string | null }).salary ?? null) || "—"} />
                <Mini label="Location" value={c.location ?? "—"} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <Mini label="Email" value={c.email ?? "—"} />
                <Mini label="Phone" value={c.phone ?? "—"} />
                {a.match_score != null && <Mini label="AI Match" value={`${a.match_score}%`} />}
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
                {c.linkedin_url && (
                  <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[#0A66C2]/30 bg-[#0A66C2]/10 text-[#0A66C2] text-sm font-medium hover:bg-[#0A66C2]/20">
                    <Linkedin className="size-4" /> View LinkedIn profile
                  </a>
                )}
                <div className="flex-1" />
                {a.stage === "client_rejected" ? (
                  <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium">
                    <X className="size-4" /> Rejected
                  </span>
                ) : a.stage === "on_hold" ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-warning/15 text-warning text-sm font-medium border border-warning/25">
                      <Pause className="size-4" /> On hold
                    </span>
                    <button
                      onClick={() => onUpdate(a.id, "shared_with_client")}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary disabled:opacity-50">
                      <Play className="size-4" /> Resume review
                    </button>
                    <button
                      onClick={() => onUpdate(a.id, "client_rejected")}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 disabled:opacity-50">
                      <X className="size-4" /> Reject
                    </button>
                    <button
                      onClick={() => onUpdate(a.id, "client_shortlist")}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-success text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                      <Check className="size-4" /> Shortlist
                    </button>
                  </>
                ) : canSchedule ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-success/10 text-success text-sm font-medium">
                      <Check className="size-4" /> Shortlisted
                    </span>
                    <button
                      onClick={() => onSchedule(a)}
                      disabled={pending || a.stage === "interview_scheduled"}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                      <Calendar className="size-4" /> {a.stage === "interview_scheduled" ? "Interview scheduled" : "Schedule interview"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onUpdate(a.id, "client_rejected")}
                      disabled={pending || a.stage === "closed"}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 disabled:opacity-50">
                      <X className="size-4" /> Reject
                    </button>
                    <button
                      onClick={() => onUpdate(a.id, "client_shortlist")}
                      disabled={pending || a.stage === "client_shortlist" || a.stage === "interview_scheduled" || a.stage === "rounds" || a.stage === "offered"}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-success text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                      <Check className="size-4" /> Shortlist
                    </button>
                    <button
                      onClick={() => onUpdate(a.id, "on_hold")}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary disabled:opacity-50">
                      <Pause className="size-4" /> Put on hold
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })}
      {editFor && (
        <EditCandidateDialog
          open={!!editFor}
          onOpenChange={(v) => { if (!v) setEditFor(null); }}
          candidate={editFor}
        />
      )}
    </div>
  );
}

function StageBadge({ stage }: { stage: ApplicationStage }) {
  const tone: Record<string, string> = {
    shared_with_client: "bg-warning/15 text-warning",
    client_shortlist: "bg-purple/15 text-purple",
    client_rejected: "bg-destructive/15 text-destructive",
    on_hold: "bg-warning/15 text-warning",
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

function ScheduleInterviewDialog({
  app, onClose, onSubmit, pending, googleConnected,
}: {
  app: ApplicationRow | null;
  onClose: () => void;
  onSubmit: (scheduled_at: string, rounds: RoundDraft[], provider: InterviewProvider, location: string | null) => void;
  pending: boolean;
  googleConnected: boolean;
}) {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("10:00");
  const [provider, setProvider] = useState<InterviewProvider>("google_meet");
  const [location, setLocation] = useState("");
  const [rounds, setRounds] = useState<RoundDraft[]>([
    { kind: "hr_screen", custom_kind_label: null, interviewer: "" },
  ]);
  const fetchMembers = useServerFn(listClientMembers);
  const membersQ = useQuery({
    queryKey: ["client-members"],
    queryFn: () => fetchMembers(),
    enabled: !!app,
  });
  const memberOptions = (membersQ.data?.members ?? [])
    .filter((m) => m.status === "active")
    .map((m) => m.full_name || m.invited_email || "Unnamed")
    .filter((v): v is string => !!v);

  useEffect(() => {
    if (app) {
      setDate(undefined);
      setTime("10:00");
      setProvider("google_meet");
      setLocation("");
      setRounds([{ kind: "hr_screen", custom_kind_label: null, interviewer: "" }]);
    }
  }, [app?.id]);

  const isVirtual = provider === "google_meet" || provider === "microsoft_teams" || provider === "zoom";
  const needsGoogle = isVirtual && !googleConnected;
  const canSubmit = !!date && !pending && !needsGoogle;

  const defaultKindFor = (i: number): InterviewKind =>
    i === 0 ? "hr_screen" : i === 1 ? "technical" : i === 2 ? "hiring_manager" : "technical";

  const addRound = () => {
    setRounds((rs) =>
      rs.length >= 10
        ? rs
        : [...rs, { kind: defaultKindFor(rs.length), custom_kind_label: null, interviewer: "" }],
    );
  };
  const removeRound = (idx: number) =>
    setRounds((rs) => (rs.length <= 1 ? rs : rs.filter((_, i) => i !== idx)));
  const updateRound = (idx: number, patch: Partial<RoundDraft>) =>
    setRounds((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  return (
    <Dialog open={!!app} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule interview</DialogTitle>
          <DialogDescription>
            {app?.candidate?.name ? `For ${app.candidate.name}.` : null} Pick a preferred date and time for round 1, then configure the rounds and interviewers. The recruiter will confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Preferred date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <Calendar className="mr-2 size-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            </div>
            <div className="grid gap-2">
              <Label>Preferred time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Meeting mode</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as InterviewProvider)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVIEW_PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>{INTERVIEW_PROVIDER_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {provider === "google_meet"
                ? "The recruiter will generate a Google Meet link from their connected calendar when they confirm."
                : provider === "microsoft_teams" || provider === "zoom"
                  ? "The recruiter will share the meeting link when they confirm."
                  : provider === "on_site"
                    ? "Add the office address / location below."
                    : "The recruiter will call the candidate at the confirmed time."}
            </p>
          </div>

          {provider === "on_site" && (
            <div className="grid gap-2">
              <Label>Location / address</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. 4th floor, Tower B, Mumbai office"
              />
            </div>
          )}

          {needsGoogle && (
            <GoogleCalendarCard description="Video interviews require a connected Google account so we can generate a Meet link and email the candidate an invite. Connect below to continue — or pick 'Offline / In-person' or 'Phone' instead." />
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Rounds ({rounds.length})</Label>
              <button
                type="button"
                onClick={addRound}
                disabled={rounds.length >= 10}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium border border-border hover:bg-secondary disabled:opacity-50"
              >
                <Plus className="size-3.5" /> Add round
              </button>
            </div>
            <div className="grid gap-2">
              {rounds.map((r, i) => (
                <RoundRow
                  key={i}
                  index={i}
                  round={r}
                  memberOptions={memberOptions}
                  canRemove={rounds.length > 1}
                  onChange={(patch) => updateRound(i, patch)}
                  onRemove={() => removeRound(i)}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button
            disabled={!canSubmit}
            onClick={() => {
              if (!date) return;
              const [h, mi] = time.split(":").map(Number);
              const dt = new Date(date);
              dt.setHours(h || 10, mi || 0, 0, 0);
              const cleaned: RoundDraft[] = rounds.map((r) => ({
                kind: r.kind,
                custom_kind_label:
                  r.kind === "case_study" || r.custom_kind_label
                    ? r.custom_kind_label?.trim() || null
                    : null,
                interviewer: r.interviewer?.trim() || null,
              }));
              onSubmit(dt.toISOString(), cleaned, provider, provider === "on_site" ? (location.trim() || null) : null);
            }}
          >
            {pending ? "Requesting…" : "Request interview"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RoundDraft = {
  kind: InterviewKind;
  custom_kind_label: string | null;
  interviewer: string | null;
};

const OTHER_INTERVIEWER = "__other__";

function RoundRow({
  index, round, memberOptions, canRemove, onChange, onRemove,
}: {
  index: number;
  round: RoundDraft;
  memberOptions: string[];
  canRemove: boolean;
  onChange: (patch: Partial<RoundDraft>) => void;
  onRemove: () => void;
}) {
  const interviewerValue = round.interviewer ?? "";
  const isKnown = interviewerValue !== "" && memberOptions.includes(interviewerValue);
  const [other, setOther] = useState(!isKnown && interviewerValue !== "");
  const selectValue = other || (!isKnown && interviewerValue !== "")
    ? OTHER_INTERVIEWER
    : interviewerValue || "__none__";

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground">Round {index + 1}</div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" /> Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">Type</Label>
          <Select value={round.kind} onValueChange={(v) => onChange({ kind: v as InterviewKind })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INTERVIEW_KINDS.map((k) => (
                <SelectItem key={k} value={k}>{INTERVIEW_KIND_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">Interviewer</Label>
          <Select
            value={selectValue}
            onValueChange={(v) => {
              if (v === OTHER_INTERVIEWER) {
                setOther(true);
                onChange({ interviewer: "" });
              } else if (v === "__none__") {
                setOther(false);
                onChange({ interviewer: null });
              } else {
                setOther(false);
                onChange({ interviewer: v });
              }
            }}
          >
            <SelectTrigger><SelectValue placeholder="Assign…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {memberOptions.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
              <SelectItem value={OTHER_INTERVIEWER}>Someone else…</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {other && (
        <Input
          placeholder="Interviewer name"
          value={round.interviewer ?? ""}
          onChange={(e) => onChange({ interviewer: e.target.value })}
        />
      )}
      {round.kind === "case_study" && (
        <Input
          placeholder="Optional: custom label (e.g. Take-home assignment)"
          value={round.custom_kind_label ?? ""}
          onChange={(e) => onChange({ custom_kind_label: e.target.value })}
        />
      )}
    </div>
  );
}

