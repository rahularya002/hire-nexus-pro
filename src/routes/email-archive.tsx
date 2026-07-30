import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Mail,
  Loader2,
  Search,
  MapPin,
  Building2,
  FileText,
  Sparkles,
  Play,
  Pause,
  UserPlus,
  Inbox,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Trash2,
  ShieldQuestion,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getMyGoogleConnection, startGoogleOAuth } from "@/lib/google-calendar.functions";
import {
  approveReviewItem,
  cancelImportRun,
  cleanNonCandidates,
  getArchiveResumeUrl,
  getEmailCandidate,
  getImportProgress,
  listEmailCandidates,
  listGmailLabels,
  listReviewItems,
  processImportBatch,
  promoteArchivePerson,
  rejectReviewItem,
  resumeImportRun,
  setArchiveReviewStatus,
  enrichArchivePerson,
  startImportRun,
  type ArchivePerson,
  type ReviewItem,
} from "@/lib/email-import.functions";
import { initialsOf } from "@/lib/display";

export const Route = createFileRoute("/email-archive")({
  head: () => ({
    meta: [
      { title: "Email Archive — Candidate intelligence from your inbox" },
      {
        name: "description",
        content:
          "Import years of recruiter email history, resumes and conversations into a searchable candidate archive kept separate from your main candidate database.",
      },
      { property: "og:title", content: "Email Archive — Candidate intelligence from your inbox" },
      {
        property: "og:description",
        content: "Turn Gmail resumes and candidate conversations into a searchable talent archive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

function lpa(min: number | null, max: number | null) {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} LPA`;
  return `${min ?? max} LPA`;
}

/** AI extraction sometimes stored the literal string "null" — never show it. */
function txt(v?: string | null) {
  if (!v) return null;
  const t = v.trim();
  if (!t || /^(null|undefined|n\/a|na|none|unknown|-)$/i.test(t)) return null;
  return t;
}

const KIND_LABEL: Record<string, string> = {
  candidate_submission: "Candidate submission",
  resume_forward: "Resume forward",
  job_application: "Job application",
  interview_scheduling: "Interview scheduling",
  recruiter_conversation: "Recruiter conversation",
  job_alert: "Job alert",
  bank_statement: "Bank / brokerage statement",
  invoice_receipt: "Invoice or receipt",
  travel: "Travel",
  order_shipping: "Order / shipping",
  newsletter_promo: "Newsletter or promotion",
  otp_security: "OTP / security",
  other: "Other",
};

const ARTIFACT_FILTERS = [
  ["all", "All outcomes"],
  ["candidate_profile", "Candidate detected"],
  ["candidate_plus_conversation", "Candidate + conversation"],
  ["recruitment_conversation", "Recruitment conversation"],
  ["job_description", "Job description"],
  ["interview_feedback", "Interview feedback"],
  ["administrative", "No candidate found"],
] as const;

/**
 * Outcome chip: says what the email actually produced, not how "recruitment-y"
 * it looked. Candidate confidence only shows when a candidate was detected.
 */
function OutcomeBadge({
  artifact,
  score,
  state,
}: {
  artifact?: string | null;
  score?: number | null;
  state: "imported" | "needs_review" | "skipped";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const a = artifact ?? (state === "imported" ? "candidate_profile" : "administrative");
  const isCandidate = a === "candidate_profile" || a === "candidate_plus_conversation";

  let label: string;
  let tone: string;
  if (state === "needs_review") {
    label = "Possible candidate — needs a look";
    tone = "bg-warning/10 text-warning border-warning/30";
  } else if (isCandidate) {
    label = a === "candidate_plus_conversation" ? "Candidate + conversation" : "Candidate detected";
    tone = "bg-success/10 text-success border-success/25";
  } else if (a === "job_description") {
    label = "Job description — stored as requirement";
    tone = "bg-primary/10 text-primary border-primary/25";
  } else if (a === "recruitment_conversation") {
    label = "Recruitment conversation — stored in archive";
    tone = "bg-secondary text-muted-foreground border-border";
  } else if (a === "interview_feedback") {
    label = "Interview feedback — stored in history";
    tone = "bg-secondary text-muted-foreground border-border";
  } else {
    label = "No candidate found";
    tone = "bg-muted text-muted-foreground border-border";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${tone}`}
      title={
        isCandidate || state === "needs_review"
          ? `Candidate confidence — how sure we are this email holds an importable profile: ${pct}%`
          : "This email holds no importable candidate profile."
      }
    >
      {(isCandidate || state === "needs_review") && <span className="font-semibold">{pct}%</span>}
      {label}
      {state === "imported" && isCandidate ? <span className="opacity-80">· ready to import</span> : null}
    </span>
  );
}

function Page() {
  const qc = useQueryClient();
  const fetchConn = useServerFn(getMyGoogleConnection);
  const startOAuth = useServerFn(startGoogleOAuth);
  const fetchLabels = useServerFn(listGmailLabels);
  const fetchProgress = useServerFn(getImportProgress);
  const startRun = useServerFn(startImportRun);
  const runBatch = useServerFn(processImportBatch);
  const pauseRun = useServerFn(cancelImportRun);
  const resumeRun = useServerFn(resumeImportRun);
  const fetchPeople = useServerFn(listEmailCandidates);
  const cleanup = useServerFn(cleanNonCandidates);
  const fetchReview = useServerFn(listReviewItems);
  const approve = useServerFn(approveReviewItem);
  const reject = useServerFn(rejectReviewItem);

  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("");
  const [location, setLocation] = useState("");
  const [recentOnly, setRecentOnly] = useState(false);
  const [selected, setSelected] = useState<ArchivePerson | null>(null);
  const [tab, setTab] = useState<"archive" | "needs_review" | "context" | "skipped">("archive");
  const [archiveStatus, setArchiveStatus] = useState<"imported" | "needs_review" | "rejected" | "all">("imported");
  const [artifact, setArtifact] = useState<string>("all");

  const conn = useQuery({ queryKey: ["google-connection"], queryFn: () => fetchConn() });
  const labels = useQuery({
    queryKey: ["gmail-labels"],
    queryFn: () => fetchLabels(),
    enabled: !!conn.data?.connected,
  });
  const progress = useQuery({
    queryKey: ["email-import-progress"],
    queryFn: () => fetchProgress(),
  });
  const people = useQuery({
    queryKey: ["email-archive-people", search, skill, location, recentOnly, archiveStatus, artifact],
    queryFn: () =>
      fetchPeople({
        data: {
          search: search.trim() || undefined,
          skill: skill.trim() || undefined,
          location: location.trim() || undefined,
          contactedWithinDays: recentOnly ? 90 : null,
          reviewStatus: archiveStatus,
          artifact,
        },
      }),
  });
  const reviewQ = useQuery({
    queryKey: ["email-archive-review", tab],
    queryFn: () =>
      fetchReview({
        data:
          tab === "context"
            ? { status: "skipped" as const, contextOnly: true }
            : { status: tab === "skipped" ? ("skipped" as const) : ("needs_review" as const) },
      }),
    enabled: tab !== "archive",
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approve({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`${r.name} added to the archive.`);
      qc.invalidateQueries({ queryKey: ["email-archive-review"] });
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not import this email"),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => reject({ data: { id } }),
    onSuccess: () => {
      toast.success("Marked as not recruitment.");
      qc.invalidateQueries({ queryKey: ["email-archive-review"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const run = progress.data;
  const running = run?.status === "running";

  // Drive the import forward one batch at a time while the run is active.
  const busyRef = useRef(false);
  useEffect(() => {
    if (!running || !run?.id || busyRef.current) return;
    let cancelled = false;
    busyRef.current = true;
    (async () => {
      try {
        const res = await runBatch({ data: { runId: run.id } });
        if (cancelled) return;
        qc.invalidateQueries({ queryKey: ["email-import-progress"] });
        if (res.newPeople.length) qc.invalidateQueries({ queryKey: ["email-archive-people"] });
        if (res.done) {
          toast.success("Email import finished.");
          qc.invalidateQueries({ queryKey: ["email-archive-people"] });
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Import failed");
          qc.invalidateQueries({ queryKey: ["email-import-progress"] });
        }
      } finally {
        busyRef.current = false;
        if (!cancelled) qc.invalidateQueries({ queryKey: ["email-import-progress"] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [running, run?.id, run?.emails_scanned, runBatch, qc]);

  // Import setup state
  const [months, setMonths] = useState(12);
  const [selLabels, setSelLabels] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState("");

  const start = useMutation({
    mutationFn: async () => {
      const from = new Date();
      from.setMonth(from.getMonth() - months);
      return startRun({
        data: {
          dateFrom: from.toISOString(),
          dateTo: null,
          labels: selLabels,
          exclusions: exclusions
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
    },
    onSuccess: () => {
      toast.success("Import started — you can keep working while it runs.");
      qc.invalidateQueries({ queryKey: ["email-import-progress"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start import"),
  });

  const connect = async () => {
    const { authUrl } = await startOAuth({ data: { origin: window.location.origin } });
    try {
      sessionStorage.setItem("google-oauth-return", "/email-archive");
    } catch {}
    window.location.href = authUrl;
  };

  const rows = people.data ?? [];
  const stats = useMemo(
    () => ({
      people: rows.length,
      resumes: rows.reduce((a, r) => a + (r.resume_count ?? 0), 0),
      promoted: rows.filter((r) => r.promoted_candidate_id).length,
    }),
    [rows],
  );

  const gmailReady = !!conn.data?.connected && labels.data?.gmail !== false;

  const cleanMut = useMutation({
    mutationFn: () => cleanup(),
    onSuccess: (r) => {
      toast.success(
        `Re-scored ${r.scored} record${r.scored === 1 ? "" : "s"} — ${r.imported} kept, ${r.review} flagged for review, ${r.rejected} marked low confidence. Nothing was deleted — switch the archive filter to see them.`,
      );
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
      qc.invalidateQueries({ queryKey: ["email-archive-review"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Re-scoring failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Mail className="size-5 text-primary" /> Email Archive
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Bring years of recruiter email history into a searchable archive. This stays separate from your
            candidate database — add people over only when you choose to.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Button
            variant="outline"
            size="sm"
            className="self-center"
            onClick={() => cleanMut.mutate()}
            disabled={cleanMut.isPending}
          >
            {cleanMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Re-score archive
          </Button>
          {[
            { label: "People in archive", value: stats.people },
            { label: "Resumes", value: stats.resumes },
            { label: "Added to DB", value: stats.promoted },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 min-w-[110px]">
              <div className="text-lg font-semibold">{s.value}</div>
              <div className="text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Connect / import panel */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        {!conn.data?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Inbox className="size-4 text-primary" /> Connect your mailbox
            </div>
            <p className="text-xs text-muted-foreground">
              We request read-only Gmail access, scan only emails with resume attachments, and never send email
              on your behalf.
            </p>
            <Button onClick={connect}>Connect Gmail</Button>
          </div>
        ) : !gmailReady ? (
          <div className="space-y-3">
            <div className="text-sm font-semibold">Gmail access needed</div>
            <p className="text-xs text-muted-foreground">
              Your Google account is connected for calendar only. Reconnect to grant read-only Gmail access.
            </p>
            <Button onClick={connect}>Reconnect Google</Button>
          </div>
        ) : running || run?.status === "paused" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {running ? <Loader2 className="size-4 animate-spin text-primary" /> : <Pause className="size-4" />}
              {running ? "Importing from" : "Import paused —"} {run?.google_email}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {[
                ["Emails scanned", run?.emails_scanned ?? 0],
                ["Recruitment emails", run?.resume_emails ?? 0],
                ["People found", run?.people_found ?? 0],
                ["Profiles enriched", run?.people_enriched ?? 0],
                ["Needs review", run?.needs_review ?? 0],
                ["Skipped as noise", run?.skipped_noise ?? run?.skipped_non_resume ?? 0],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="text-base font-semibold">{value as number}</div>
                  <div className="text-muted-foreground">{label as string}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                Decided by rules:{" "}
                <span className="font-medium text-foreground">
                  {Math.max(0, (run?.emails_scanned ?? 0) - (run?.ai_calls ?? 0))}
                </span>
              </span>
              <span>
                AI calls: <span className="font-medium text-foreground">{run?.ai_calls ?? 0}</span>
              </span>
              <span>
                Cache hits: <span className="font-medium text-foreground">{run?.cache_hits ?? 0}</span>
              </span>
              <span>
                Auto-imported: <span className="font-medium text-foreground">{run?.auto_imported ?? 0}</span>
              </span>
            </div>
            <div className="flex gap-2">
              {running ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    await pauseRun({ data: { runId: run!.id } });
                    qc.invalidateQueries({ queryKey: ["email-import-progress"] });
                  }}
                >
                  <Pause className="size-3.5" /> Pause
                </Button>
              ) : (
                <Button
                  onClick={async () => {
                    await resumeRun({ data: { runId: run!.id } });
                    qc.invalidateQueries({ queryKey: ["email-import-progress"] });
                  }}
                >
                  <Play className="size-3.5" /> Resume
                </Button>
              )}
              {!!run?.failures && (
                <span className="text-xs text-muted-foreground self-center">
                  {run.failures} email{run.failures === 1 ? "" : "s"} skipped
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> Import candidate history
              <span className="text-xs font-normal text-muted-foreground">({conn.data.google_email})</span>
            </div>
            {run?.status === "completed" && (
              <div className="text-xs text-success flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" /> Last import finished {fmtDate(run.finished_at)} —{" "}
                {run.people_found} people from {run.emails_scanned} emails.
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">How far back</Label>
                <select
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  {[6, 12, 24, 36, 60].map((m) => (
                    <option key={m} value={m}>
                      Last {m} months
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Labels / folders (optional)</Label>
                <select
                  multiple
                  value={selLabels}
                  onChange={(e) =>
                    setSelLabels(Array.from(e.target.selectedOptions).map((o) => o.value))
                  }
                  className="min-h-[76px] w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                >
                  {(labels.data?.labels ?? []).map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Exclude senders / domains</Label>
                <Input
                  value={exclusions}
                  onChange={(e) => setExclusions(e.target.value)}
                  placeholder="naukri.com, no-reply@linkedin.com"
                />
              </div>
            </div>
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              {start.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              Start import
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        {(
          [
            ["archive", "Archive"],
            ["needs_review", `Needs review${run?.needs_review ? ` (${run.needs_review})` : ""}`],
            ["context", "Recruitment context"],
            ["skipped", "Skipped"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
              tab === key ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "archive" ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {tab === "needs_review"
              ? "Only emails where we genuinely can't tell whether an importable candidate is inside — a resume pasted in the body, an unreadable scan, or mixed attachments."
              : tab === "context"
                ? "Recruitment conversations, job descriptions and interview feedback. These are kept as context — they contain no candidate to import, so they never need your review."
                : "Emails with no candidate in them. Nothing here created a profile."}
          </p>
          {reviewQ.isLoading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (reviewQ.data ?? []).length === 0 ? (
            <EmptyState
              icon={ShieldQuestion}
              title={
                tab === "needs_review"
                  ? "Nothing waiting for review"
                  : tab === "context"
                    ? "No recruitment context stored yet"
                    : "Nothing skipped yet"
              }
              description="Run an import and each email is routed by what it actually contains."
            />
          ) : (
            <div className="space-y-2">
              {(reviewQ.data as ReviewItem[]).map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <OutcomeBadge
                          artifact={r.artifact_type}
                          score={r.confidence}
                          state={tab === "needs_review" ? "needs_review" : "skipped"}
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {KIND_LABEL[r.email_kind ?? "other"] ?? "Other"}
                        </span>
                      </div>
                      <div className="text-sm font-medium truncate mt-1">{r.subject ?? "(no subject)"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {txt(r.from_name) ? `${txt(r.from_name)} · ` : ""}
                        {r.from_email ?? "unknown sender"} · {fmtDate(r.sent_at)}
                      </div>
                      {txt(r.reason) && <p className="text-[11px] text-muted-foreground mt-1">{txt(r.reason)}</p>}
                      {r.attachment_names.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {r.attachment_names.map((n) => (
                            <span key={n} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary truncate max-w-[200px]">
                              {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveMut.mutate(r.id)}
                        disabled={approveMut.isPending || !r.has_payload}
                        title={r.has_payload ? "Import the candidate in this email" : "Re-run the import to recover this email"}
                      >
                        <Check className="size-3.5" /> Import candidate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectMut.mutate(r.id)}
                        disabled={rejectMut.isPending}
                      >
                        <X className="size-3.5" /> No candidate here
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
      <>
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resumes, emails, skills…"
            className="pl-9"
          />
        </div>
        <Input
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          placeholder="Skill"
          className="w-[150px]"
        />
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          className="w-[150px]"
        />
        <Button variant={recentOnly ? "default" : "outline"} onClick={() => setRecentOnly((v) => !v)}>
          Contacted in 90 days
        </Button>
        <select
          value={archiveStatus}
          onChange={(e) => setArchiveStatus(e.target.value as typeof archiveStatus)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Archive confidence filter"
        >
          <option value="imported">Imported candidates</option>
          <option value="needs_review">Flagged for review</option>
          <option value="rejected">No candidate detected</option>
          <option value="all">Everyone</option>
        </select>
        <select
          value={artifact}
          onChange={(e) => setArtifact(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Archive outcome filter"
        >
          {ARTIFACT_FILTERS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {/* People */}
      {people.isLoading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Loading archive…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Mail}
          title={archiveStatus === "imported" ? "Nothing in the archive yet" : "No people with this status"}
          description={
            archiveStatus === "imported"
              ? "Connect your mailbox and run an import to surface candidates you already know. If you just re-scored, check the other status filters."
              : "Try another status filter — re-scored people are never deleted."
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="size-9 shrink-0 rounded-full bg-secondary grid place-items-center text-xs font-semibold">
                  {initialsOf(p.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{p.name}</div>
                    {p.promoted_candidate_id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/25">
                        In DB
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.email ?? "No email"}</div>
                  <div className="mt-1.5">
                    <OutcomeBadge
                      artifact={p.artifact_type}
                      score={p.confidence}
                      state={
                        p.review_status === "needs_review"
                          ? "needs_review"
                          : p.review_status === "rejected"
                            ? "skipped"
                            : "imported"
                      }
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {txt(p.role) && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <Building2 className="size-3" /> {txt(p.role)}
                        {txt(p.current_company) ? ` · ${txt(p.current_company)}` : ""}
                      </span>
                    )}
                    {txt(p.location) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {txt(p.location)}
                      </span>
                    )}
                    {lpa(p.salary_min, p.salary_max) && <span>{lpa(p.salary_min, p.salary_max)}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.skills.slice(0, 5).map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {p.resume_count} resume{p.resume_count === 1 ? "" : "s"} · {p.email_count} email
                    {p.email_count === 1 ? "" : "s"} · last {fmtDate(p.last_email_at)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      </>
      )}

      <PersonSheet person={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function PersonSheet({ person, onClose }: { person: ArchivePerson | null; onClose: () => void }) {
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getEmailCandidate);
  const resumeUrl = useServerFn(getArchiveResumeUrl);
  const promote = useServerFn(promoteArchivePerson);
  const setStatus = useServerFn(setArchiveReviewStatus);
  const enrich = useServerFn(enrichArchivePerson);

  const detail = useQuery({
    queryKey: ["email-archive-person", person?.id],
    queryFn: () => fetchDetail({ data: { id: person!.id } }),
    enabled: !!person,
  });

  const promoteMut = useMutation({
    mutationFn: () => promote({ data: { id: person!.id } }),
    onSuccess: (r) => {
      toast.success(r.alreadyPromoted ? "Already in your candidate database." : "Added to candidate database.");
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
      qc.invalidateQueries({ queryKey: ["email-archive-person", person?.id] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add candidate"),
  });

  const restoreMut = useMutation({
    mutationFn: () => setStatus({ data: { id: person!.id, reviewStatus: "imported" } }),
    onSuccess: () => {
      toast.success("Restored to the archive.");
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
      qc.invalidateQueries({ queryKey: ["email-archive-person", person?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not restore this person"),
  });

  const enrichMut = useMutation({
    mutationFn: (force: boolean) => enrich({ data: { id: person!.id, force } }),
    onSuccess: (r) => {
      toast.success(r.cached ? "Showing the saved summary." : "Summary ready.");
      qc.invalidateQueries({ queryKey: ["email-archive-person", person?.id] });
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not generate a summary"),
  });

  const openResume = async (id: string) => {
    const { url } = await resumeUrl({ data: { resumeId: id } });
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Resume file unavailable");
  };

  const p = detail.data?.person ?? person;

  return (
    <Sheet open={!!person} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{p?.name}</SheetTitle>
          <SheetDescription>
            {txt(p?.email) ?? "No email"} {txt(p?.phone) ? `· ${txt(p?.phone)}` : ""}
          </SheetDescription>
        </SheetHeader>

        {p && (
          <div className="mt-4 space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <ConfidenceBadge
                score={p.confidence}
                state={
                  p.review_status === "needs_review"
                    ? "needs_review"
                    : p.review_status === "rejected"
                      ? "skipped"
                      : "imported"
                }
              />
              <span className="text-[11px] text-muted-foreground">
                {KIND_LABEL[p.email_kind ?? "other"] ?? "Other"}
              </span>
            </div>
            {txt(p.classification_reason) && (
              <p className="text-[11px] text-muted-foreground -mt-3">{txt(p.classification_reason)}</p>
            )}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">AI summary</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => enrichMut.mutate(!!p.ai_summary)}
                  disabled={enrichMut.isPending}
                >
                  {enrichMut.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {p.ai_summary ? "Regenerate" : "Generate"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-line">
                {txt(p.ai_summary) ??
                  "No summary yet. Summaries are only written when you ask, so imports stay fast and cheap."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.review_status !== "imported" && (
                <Button variant="outline" onClick={() => restoreMut.mutate()} disabled={restoreMut.isPending}>
                  <CheckCircle2 className="size-4" /> Restore to archive
                </Button>
              )}
              <Button
                onClick={() => promoteMut.mutate()}
                disabled={promoteMut.isPending || !!p.promoted_candidate_id}
              >
                {promoteMut.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <UserPlus className="size-3.5" />
                )}
                {p.promoted_candidate_id ? "In candidate database" : "Add to candidate database"}
              </Button>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Relationship
              </div>
              <div className="text-xs text-muted-foreground">
                First contact {fmtDate(p.first_email_at)} · last contact {fmtDate(p.last_email_at)} ·{" "}
                {p.email_count} email{p.email_count === 1 ? "" : "s"} · {p.resume_count} resume version
                {p.resume_count === 1 ? "" : "s"}
              </div>
              {txt(p.notes) && <p className="text-xs">{txt(p.notes)}</p>}
              {p.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {p.skills.map((s) => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resume versions
              </div>
              {(detail.data?.resumes ?? []).length === 0 ? (
                <div className="text-xs text-muted-foreground">No resume files stored.</div>
              ) : (
                (detail.data?.resumes ?? []).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => openResume(r.id)}
                    className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/50 flex items-center gap-2"
                  >
                    <FileText className="size-4 text-primary shrink-0" />
                    <span className="text-xs truncate flex-1">{r.file_name}</span>
                    <span className="text-[11px] text-muted-foreground">{fmtDate(r.received_at)}</span>
                  </button>
                ))
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Email timeline
              </div>
              {(detail.data?.messages ?? []).map((m) => (
                <div key={m.id} className="rounded-lg border border-border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    {m.direction === "outbound" ? (
                      <ArrowUpRight className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ArrowDownLeft className="size-3.5 text-primary" />
                    )}
                    <span className="text-xs font-medium truncate flex-1">{m.subject ?? "(no subject)"}</span>
                    <span className="text-[11px] text-muted-foreground">{fmtDate(m.sent_at)}</span>
                  </div>
                  {m.snippet && <p className="text-[11px] text-muted-foreground line-clamp-2">{m.snippet}</p>}
                </div>
              ))}
              {detail.isLoading && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" /> Loading history…
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}