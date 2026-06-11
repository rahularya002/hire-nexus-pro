import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Check, RotateCcw, UserX, Trash2, Settings2,
  Video, Calendar, Bell, FileText, MessageSquare, Send, Mail, Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  getInterviewProcess,
  createInterview,
  updateInterview,
  deleteInterview,
  INTERVIEW_STATUSES,
  INTERVIEW_PROVIDERS,
  INTERVIEW_KINDS,
  INTERVIEW_STATUS_LABEL,
  INTERVIEW_PROVIDER_LABEL,
  INTERVIEW_KIND_LABEL,
  INTERVIEW_CONDUCTORS,
  INTERVIEW_CONDUCTOR_LABEL,
  interviewRoundLabel,
  formatInterviewWhen,
  type InterviewRow,
  type InterviewStatus,
  type InterviewProvider,
  type InterviewKind,
  type InterviewConductor,
} from "@/lib/interviews.functions";
import { listInterviewRoundTemplates, type InterviewRoundTemplate } from "@/lib/interview-templates.functions";
import {
  createInterviewRoundTemplate,
  deleteInterviewRoundTemplate,
} from "@/lib/interview-templates.functions";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { RescheduleInterviewDialog } from "@/components/reschedule-interview-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/interviews/$processId")({
  component: () => <AppShell><Detail /></AppShell>,
});

function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
}

function Detail() {
  const { processId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProcess = useServerFn(getInterviewProcess);
  const createFn = useServerFn(createInterview);
  const updateFn = useServerFn(updateInterview);
  const deleteFn = useServerFn(deleteInterview);
  const fetchTemplates = useServerFn(listInterviewRoundTemplates);

  const queryKey = ["interview-process", processId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchProcess({ data: { applicationId: processId } }),
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["interview-round-templates"],
    queryFn: () => fetchTemplates(),
  });
  const activeTemplates = templates.filter((t) => !t.archived);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["staff-interviews"] });
    qc.invalidateQueries({ queryKey: ["client-interviews"] });
  };

  const updateMutation = useMutation({
    mutationFn: (vars: any) => updateFn({ data: vars }),
    onSuccess: invalidate,
  });
  const createMutation = useMutation({
    mutationFn: (vars: any) => createFn({ data: vars }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <div className="space-y-3 mt-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data || !data.application) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-muted-foreground">Interview process not found.</p>
        <button onClick={() => navigate({ to: "/interviews" })} className="text-sm text-primary mt-2 font-medium">← Back</button>
      </div>
    );
  }

  const app = data.application as {
    id: string;
    candidate: { id: string; name: string; role: string | null } | null;
    position: { id: string; title: string; client_id: string; client: { id: string; name: string } | null } | null;
  };
  const rounds = data.rounds;
  const completed = rounds.filter((r) => r.status === "completed").length;
  const candidateName = app.candidate?.name ?? "Unknown";
  const clientName = app.position?.client?.name ?? "Client";

  const addRound = () => {
    if (!app.candidate || !app.position) return;
    createMutation.mutate({
      application_id: app.id,
      candidate_id: app.candidate.id,
      position_id: app.position.id,
      round_index: rounds.length + 1,
      kind: "panel",
      status: "pending_confirmation",
      provider: "google_meet",
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <Link to="/interviews" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-3" /> Back to interviews
        </Link>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <div className="size-12 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center font-semibold">
            {initialsOf(candidateName)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight truncate">{candidateName}</h1>
            <div className="text-sm text-muted-foreground">
              {app.position?.title ?? "—"} · {app.position?.client?.name ?? "—"}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Round <span className="font-semibold text-foreground tabular-nums">{Math.min(completed + 1, Math.max(rounds.length, 1))}</span> of {rounds.length || "—"}</div>
            <div className="mt-1">{Math.max(rounds.length - completed, 0)} remaining</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold tracking-tight text-sm">Round progression</h2>
          <button onClick={addRound} className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline">
            <Plus className="size-3" /> Add round
          </button>
        </div>
        {rounds.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">No rounds yet. Add the first round to start orchestrating.</div>
        ) : (
          <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
            {rounds.map((r) => (
              <div key={r.id} className="flex-1 min-w-[140px]">
                <div className={cn(
                  "rounded-lg border-2 px-3 py-2.5",
                  r.status === "completed" ? "border-success bg-success/5" :
                  r.status === "confirmed" ? "border-primary bg-primary/5" :
                  r.status === "no_show" ? "border-destructive bg-destructive/5" :
                  r.status === "reschedule_requested" ? "border-info bg-info/5" :
                  "border-border bg-secondary/40"
                )}>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Round {r.round_index}</div>
                  <div className="text-sm font-semibold truncate">{interviewRoundLabel(r)}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{INTERVIEW_CONDUCTOR_LABEL[r.conducted_by]}</div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">{formatInterviewWhen(r.scheduled_at)}</div>
                  <div className="text-[10px] mt-1 truncate font-medium">{INTERVIEW_STATUS_LABEL[r.status]}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {rounds.map((r) => (
          <RoundCard
            key={r.id}
            r={r}
            templates={activeTemplates}
            clientName={clientName}
            onUpdate={(patch) => updateMutation.mutate({ id: r.id, ...patch })}
            onDelete={() => deleteMutation.mutate(r.id)}
          />
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-3 text-[11px] text-muted-foreground">
        Manual operational control: any round status, slot, provider, reminder or attachment can be overridden by the recruiter at any time.
      </div>
    </div>
  );
}

function RoundCard({
  r, templates, clientName, onUpdate, onDelete,
}: {
  r: InterviewRow;
  templates: InterviewRoundTemplate[];
  clientName: string;
  onUpdate: (patch: Partial<InterviewRow>) => void;
  onDelete: () => void;
}) {
  const [rescheduling, setRescheduling] = useState(false);
  const dtLocal = r.scheduled_at ? new Date(r.scheduled_at).toISOString().slice(0, 16) : "";
  const onSelectRound = (value: string) => {
    if (value.startsWith("builtin:")) {
      const k = value.slice("builtin:".length) as InterviewKind;
      onUpdate({ kind: k, custom_kind_label: null });
    } else {
      const name = value.slice("custom:".length);
      const tpl = templates.find((t) => t.name === name);
      const patch: Partial<InterviewRow> = { custom_kind_label: name };
      if (tpl) {
        (patch as any).conducted_by = tpl.default_conducted_by;
        if (tpl.default_duration_minutes) (patch as any).duration_minutes = tpl.default_duration_minutes;
      }
      onUpdate(patch);
    }
  };
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-start gap-2 min-w-0 flex-wrap">
          <span className="size-7 rounded-md bg-primary/15 text-primary grid place-items-center text-xs font-semibold tabular-nums shrink-0">R{r.round_index}</span>
          <div className="flex flex-wrap gap-1.5 items-center">
            {INTERVIEW_KINDS.map((k) => {
              const active = !r.custom_kind_label && r.kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onSelectRound(`builtin:${k}`)}
                  className={cn(
                    "h-7 px-2.5 rounded-full text-xs font-medium border transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-secondary text-foreground"
                  )}
                >
                  {INTERVIEW_KIND_LABEL[k]}
                </button>
              );
            })}
            {templates.map((t) => {
              const active = r.custom_kind_label === t.name;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectRound(`custom:${t.name}`)}
                  className={cn(
                    "h-7 px-2.5 rounded-full text-xs font-medium border transition",
                    active
                      ? "border-purple bg-purple text-primary-foreground"
                      : "border-purple/40 bg-purple/5 hover:bg-purple/10 text-purple"
                  )}
                >
                  {t.name}
                </button>
              );
            })}
            {r.custom_kind_label && !templates.some((t) => t.name === r.custom_kind_label) && (
              <span className="h-7 px-2.5 rounded-full text-xs font-medium border border-purple bg-purple text-primary-foreground inline-flex items-center">
                {r.custom_kind_label}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                const name = window.prompt("Custom round name (e.g. Culture Fit, Take-home)");
                const trimmed = name?.trim();
                if (trimmed) onSelectRound(`custom:${trimmed}`);
              }}
              className="h-7 px-2.5 rounded-full text-xs font-medium border border-dashed border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Plus className="size-3" /> Custom
            </button>
          </div>
          <span className={cn(
            "text-[11px] px-2 py-0.5 rounded-md font-medium border inline-flex items-center gap-1",
            r.conducted_by === "client"
              ? "bg-purple/10 text-purple border-purple/25"
              : "bg-primary/10 text-primary border-primary/25"
          )}>
            <Users className="size-3" />
            {r.conducted_by === "client" ? `Client · ${clientName}` : "Recruiter"}
          </span>
          <span className={cn(
            "text-[11px] px-2 py-0.5 rounded-md font-medium border",
            r.status === "completed" ? "bg-success/15 text-success border-success/25" :
            r.status === "confirmed" ? "bg-success/10 text-success border-success/20" :
            r.status === "no_show" ? "bg-destructive/10 text-destructive border-destructive/25" :
            r.status === "reschedule_requested" ? "bg-info/15 text-info border-info/25" :
            "bg-warning/15 text-warning border-warning/25"
          )}>{INTERVIEW_STATUS_LABEL[r.status]}</span>
        </div>
        <button onClick={onDelete} title="Remove" className="size-7 rounded hover:bg-destructive/10 hover:text-destructive grid place-items-center">
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="p-4 grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Field label="Conducted by">
            <div className="flex flex-wrap gap-1">
              {INTERVIEW_CONDUCTORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdate({ conducted_by: c as InterviewConductor })}
                  className={cn(
                    "h-8 px-2.5 rounded-md text-xs font-medium border inline-flex items-center gap-1 transition",
                    r.conducted_by === c ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-secondary"
                  )}
                >
                  <Users className="size-3" />
                  {c === "client" ? `Client · ${clientName}` : INTERVIEW_CONDUCTOR_LABEL[c]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Interviewer">
            <input
              defaultValue={r.interviewer ?? ""}
              onBlur={(e) => e.target.value !== (r.interviewer ?? "") && onUpdate({ interviewer: e.target.value })}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </Field>
          <Field label="Scheduled at">
            <input
              type="datetime-local"
              defaultValue={dtLocal}
              onBlur={(e) => {
                const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                if (v !== r.scheduled_at) onUpdate({ scheduled_at: v });
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </Field>
          <Field label="Provider">
            <div className="flex flex-wrap gap-1">
              {INTERVIEW_PROVIDERS.map((p) => (
                <button
                  key={p}
                  onClick={() => onUpdate({ provider: p as InterviewProvider })}
                  className={cn(
                    "h-8 px-2.5 rounded-md text-xs font-medium border inline-flex items-center gap-1 transition",
                    r.provider === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-secondary"
                  )}
                >
                  <Video className="size-3" />{INTERVIEW_PROVIDER_LABEL[p]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Meeting link">
            <input
              defaultValue={r.meeting_link ?? ""}
              placeholder="https://..."
              onBlur={(e) => e.target.value !== (r.meeting_link ?? "") && onUpdate({ meeting_link: e.target.value || null })}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono"
            />
          </Field>
        </div>

        <div className="space-y-3">
          <Field label="Status">
            <div className="flex flex-wrap gap-1">
              {INTERVIEW_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdate({ status: s as InterviewStatus })}
                  className={cn(
                    "h-8 px-2 rounded-md text-[11px] font-medium border transition",
                    r.status === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-secondary"
                  )}
                >
                  {INTERVIEW_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Invite & reminders">
            <div className="flex flex-wrap gap-2">
              <Toggle on={r.cv_attached} onClick={() => onUpdate({ cv_attached: !r.cv_attached })} icon={FileText} label="CV in invite" />
              <Toggle on={r.recruiter_reminder} onClick={() => onUpdate({ recruiter_reminder: !r.recruiter_reminder })} icon={Bell} label="Recruiter reminder" />
              <Toggle on={r.candidate_reminder} onClick={() => onUpdate({ candidate_reminder: !r.candidate_reminder })} icon={Bell} label="Candidate reminder" />
            </div>
          </Field>
          <Field label="Quick actions">
            <div className="flex flex-wrap gap-1">
              <QuickBtn icon={Calendar} label="Send invite" />
              <QuickBtn icon={MessageSquare} label="WhatsApp" />
              <QuickBtn icon={Mail} label="Email" />
              <QuickBtn icon={Send} label="Resend" />
              <QuickBtn icon={RotateCcw} label="Reschedule" onClick={() => setRescheduling(true)} />
              <QuickBtn icon={UserX} label="Mark no-show" tone="destructive" onClick={() => onUpdate({ status: "no_show" })} />
              <QuickBtn icon={Check} label="Mark complete" tone="success" onClick={() => onUpdate({ status: "completed" })} />
            </div>
          </Field>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
        <textarea
          defaultValue={r.notes ?? ""}
          rows={2}
          onBlur={(e) => e.target.value !== (r.notes ?? "") && onUpdate({ notes: e.target.value || null })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
          placeholder="Internal notes about this round…"
        />
      </div>
      <RescheduleInterviewDialog
        interview={rescheduling ? r : null}
        onClose={() => setRescheduling(false)}
        invalidateKeys={[["interview-process", r.application_id], ["staff-interviews"], ["client-interviews"], ["interviews", "today"]]}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function Toggle({ on, onClick, icon: Icon, label }: { on: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-2.5 rounded-md text-[11px] font-medium border inline-flex items-center gap-1.5 transition",
        on ? "border-success/40 bg-success/10 text-success" : "border-border bg-card text-muted-foreground hover:bg-secondary"
      )}
    >
      <Icon className="size-3" /> {label}
    </button>
  );
}

function QuickBtn({ icon: Icon, label, tone, onClick }: { icon: React.ElementType; label: string; tone?: "destructive" | "success"; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-2.5 rounded-md text-[11px] font-medium border inline-flex items-center gap-1.5 transition",
        tone === "destructive" ? "border-border bg-card text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30" :
        tone === "success" ? "border-border bg-card text-muted-foreground hover:bg-success/10 hover:text-success hover:border-success/30" :
        "border-border bg-card text-muted-foreground hover:bg-secondary"
      )}
    >
      <Icon className="size-3" /> {label}
    </button>
  );
}