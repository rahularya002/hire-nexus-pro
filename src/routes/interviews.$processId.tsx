import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  getInterviewProcess, type InterviewRound, type RoundStatus, type MeetingProvider,
} from "@/lib/ops/store";
import {
  ArrowLeft, ArrowUp, ArrowDown, Plus, Check, RotateCcw, UserX,
  Video, Calendar, Bell, FileText, Link2, MessageSquare, Send, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/interviews/$processId")({
  component: () => <AppShell><Detail /></AppShell>,
});

const STATUSES: RoundStatus[] = ["Pending confirmation", "Confirmed", "Reschedule requested", "Completed", "No-show"];
const PROVIDERS: MeetingProvider[] = ["Google Meet", "Microsoft Teams", "Zoom", "On-site"];
const ROUND_KINDS = ["HR Screen", "Technical", "Hiring Manager", "Panel", "CEO", "Culture Fit", "Case Study"] as const;

function Detail() {
  const { processId } = Route.useParams();
  const navigate = useNavigate();
  const proc = getInterviewProcess(processId);
  const [rounds, setRounds] = useState<InterviewRound[]>(proc?.rounds ?? []);

  if (!proc) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-muted-foreground">Interview process not found.</p>
        <button onClick={() => navigate({ to: "/interviews" })} className="text-sm text-primary mt-2 font-medium">← Back</button>
      </div>
    );
  }

  const move = (id: string, dir: -1 | 1) => {
    setRounds((prev) => {
      const i = prev.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((r, idx) => ({ ...r, index: idx + 1 }));
    });
  };

  const updateRound = (id: string, patch: Partial<InterviewRound>) => {
    setRounds((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRound = () => {
    const idx = rounds.length + 1;
    setRounds((prev) => [
      ...prev,
      {
        id: `${proc.id}-r${Date.now()}`,
        index: idx,
        kind: "Panel",
        interviewer: "TBD",
        scheduledFor: "TBD",
        status: "Pending confirmation",
        provider: "Google Meet",
        cvAttached: true,
        recruiterReminder: false,
        candidateReminder: false,
      },
    ]);
  };

  const removeRound = (id: string) => {
    setRounds((prev) => prev.filter((r) => r.id !== id).map((r, i) => ({ ...r, index: i + 1 })));
  };

  const completed = rounds.filter((r) => r.status === "Completed").length;
  const currentIdx = Math.min(completed, rounds.length - 1);

  return (
    <div className="space-y-5">
      <div>
        <Link to="/interviews" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-3" /> Back to interviews
        </Link>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <div className="size-12 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center font-semibold">
            {proc.candidateInitials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight truncate">{proc.candidate}</h1>
            <div className="text-sm text-muted-foreground">{proc.position} · {proc.client}</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Round <span className="font-semibold text-foreground tabular-nums">{currentIdx + 1}</span> of {rounds.length}</div>
            <div className="mt-1">{rounds.length - completed} remaining</div>
          </div>
        </div>
      </div>

      {/* Visual round progression */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold tracking-tight text-sm">Round progression</h2>
          <button onClick={addRound} className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline">
            <Plus className="size-3" /> Add round
          </button>
        </div>
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {rounds.map((r, i) => (
            <div key={r.id} className="flex-1 min-w-[140px]">
              <div className={cn(
                "rounded-lg border-2 px-3 py-2.5",
                r.status === "Completed" ? "border-success bg-success/5" :
                r.status === "Confirmed" ? "border-primary bg-primary/5" :
                r.status === "No-show" ? "border-destructive bg-destructive/5" :
                r.status === "Reschedule requested" ? "border-info bg-info/5" :
                "border-border bg-secondary/40"
              )}>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Round {i + 1}</div>
                <div className="text-sm font-semibold truncate">{r.kind}</div>
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">{r.scheduledFor}</div>
                <div className="text-[10px] mt-1 truncate font-medium">{r.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-round orchestration */}
      <div className="space-y-3">
        {rounds.map((r, i) => (
          <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="size-7 rounded-md bg-primary/15 text-primary grid place-items-center text-xs font-semibold tabular-nums">R{i + 1}</span>
                <select
                  value={r.kind}
                  onChange={(e) => updateRound(r.id, { kind: e.target.value as InterviewRound["kind"] })}
                  className="h-8 rounded-md border border-border bg-card px-2 text-sm font-medium"
                >
                  {ROUND_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <span className={cn(
                  "text-[11px] px-2 py-0.5 rounded-md font-medium border",
                  r.status === "Completed" ? "bg-success/15 text-success border-success/25" :
                  r.status === "Confirmed" ? "bg-success/10 text-success border-success/20" :
                  r.status === "No-show" ? "bg-destructive/10 text-destructive border-destructive/25" :
                  r.status === "Reschedule requested" ? "bg-info/15 text-info border-info/25" :
                  "bg-warning/15 text-warning border-warning/25"
                )}>{r.status}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => move(r.id, -1)} disabled={i === 0} title="Move up" className="size-7 rounded hover:bg-secondary grid place-items-center disabled:opacity-30">
                  <ArrowUp className="size-3.5" />
                </button>
                <button onClick={() => move(r.id, 1)} disabled={i === rounds.length - 1} title="Move down" className="size-7 rounded hover:bg-secondary grid place-items-center disabled:opacity-30">
                  <ArrowDown className="size-3.5" />
                </button>
                <button onClick={() => removeRound(r.id)} title="Remove" className="size-7 rounded hover:bg-destructive/10 hover:text-destructive grid place-items-center">
                  <UserX className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="p-4 grid md:grid-cols-2 gap-4">
              {/* Left: scheduling */}
              <div className="space-y-3">
                <Field label="Interviewer">
                  <input
                    value={r.interviewer}
                    onChange={(e) => updateRound(r.id, { interviewer: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  />
                </Field>
                <Field label="Scheduled slot">
                  <input
                    value={r.scheduledFor}
                    onChange={(e) => updateRound(r.id, { scheduledFor: e.target.value })}
                    placeholder="e.g. Wed · 4:30 PM"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  />
                </Field>
                <Field label="Provider">
                  <div className="flex flex-wrap gap-1">
                    {PROVIDERS.map((p) => (
                      <button
                        key={p}
                        onClick={() => updateRound(r.id, { provider: p, meetingLink: p === "On-site" ? undefined : `${p.toLowerCase().replace(/\s/g, "")}.com/${r.id.slice(-6)}` })}
                        className={cn(
                          "h-8 px-2.5 rounded-md text-xs font-medium border inline-flex items-center gap-1 transition",
                          r.provider === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-secondary"
                        )}
                      >
                        <Video className="size-3" />{p}
                      </button>
                    ))}
                  </div>
                </Field>
                {r.meetingLink && (
                  <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <Link2 className="size-3" /><span className="font-mono">{r.meetingLink}</span>
                  </div>
                )}
              </div>

              {/* Right: status, reminders, attachments, actions */}
              <div className="space-y-3">
                <Field label="Status">
                  <div className="flex flex-wrap gap-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => updateRound(r.id, { status: s })}
                        className={cn(
                          "h-8 px-2 rounded-md text-[11px] font-medium border transition",
                          r.status === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-secondary"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Invite & reminders">
                  <div className="flex flex-wrap gap-2">
                    <Toggle on={r.cvAttached} onClick={() => updateRound(r.id, { cvAttached: !r.cvAttached })} icon={FileText} label="CV in invite" />
                    <Toggle on={r.recruiterReminder} onClick={() => updateRound(r.id, { recruiterReminder: !r.recruiterReminder })} icon={Bell} label="Recruiter reminder" />
                    <Toggle on={r.candidateReminder} onClick={() => updateRound(r.id, { candidateReminder: !r.candidateReminder })} icon={Bell} label="Candidate reminder" />
                  </div>
                </Field>
                <Field label="Quick actions">
                  <div className="flex flex-wrap gap-1">
                    <QuickBtn icon={Calendar} label="Send invite" />
                    <QuickBtn icon={MessageSquare} label="WhatsApp" />
                    <QuickBtn icon={Mail} label="Email" />
                    <QuickBtn icon={Send} label="Resend" />
                    <QuickBtn icon={RotateCcw} label="Reschedule" onClick={() => updateRound(r.id, { status: "Reschedule requested" })} />
                    <QuickBtn icon={UserX} label="Mark no-show" tone="destructive" onClick={() => updateRound(r.id, { status: "No-show" })} />
                    <QuickBtn icon={Check} label="Mark complete" tone="success" onClick={() => updateRound(r.id, { status: "Completed" })} />
                  </div>
                </Field>
              </div>
            </div>

            {r.notes && (
              <div className="px-4 pb-3 -mt-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
                <div className="text-xs text-muted-foreground bg-secondary/40 rounded-md p-2 border border-border">{r.notes}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Manual override hint */}
      <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-3 text-[11px] text-muted-foreground">
        Manual operational control: any round status, slot, provider, reminder or attachment can be overridden by the recruiter at any time.
        Hybrid manual + automated workflow.
      </div>
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