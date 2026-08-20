import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  Building2,
  CheckCircle2,
  Circle,
  FileText,
  History,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Unplug,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecoveryPanel } from "@/components/email-archive/recovery-panel";
import { CandidateSearchPanel } from "@/components/email-archive/search-panel";
import { HistorySheet } from "@/components/email-archive/history-sheet";
import { Progress } from "@/components/ui/progress";
import { PersonSheet } from "@/components/email-archive/person-sheet";
import { ReviewQueue } from "@/components/email-archive/review-queue";
import { KIND_LABEL, OutcomeBadge, lpa, relTime, txt } from "@/components/email-archive/shared";
import {
  approveReviewItem,
  cancelImportRun,
  clearEmailArchive,
  getImportProgress,
  getArchiveCounts,
  listEmailCandidates,
  listGmailLabels,
  listImportRuns,
  listReviewItems,
  listReviewQueue,
  processImportBatch,
  promoteArchivePerson,
  rejectReviewItem,
  rescoreArchive,
  resumeImportRun,
  startImportRun,
  stopImportRun,
  type ArchivePerson,
} from "@/lib/email-import.functions";
import { disconnectGmailAccess, startGoogleOAuth } from "@/lib/google-calendar.functions";

export const Route = createFileRoute("/email-archive")({
  component: RecruitmentMemoryPage,
  head: () => ({
    meta: [
      { title: "Recruitment Memory — Import Candidates from Gmail" },
      {
        name: "description",
        content:
          "Import years of candidate profiles, resumes and recruiting conversations from Gmail into one searchable recruitment archive.",
      },
      { property: "og:title", content: "Recruitment Memory — Import Candidates from Gmail" },
      {
        property: "og:description",
        content: "Turn your inbox history into a searchable archive of every candidate you have ever recruited.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type TabKey = "candidates" | "review" | "history" | "nocandidate";

const TABS: { key: TabKey; label: string }[] = [
  { key: "candidates", label: "Imported candidates" },
  { key: "review", label: "Needs your call" },
  { key: "history", label: "Recruiting history" },
  { key: "nocandidate", label: "No candidate found" },
];

const QUICK_FILTERS = [
  { key: "mine", label: "Only my inbox" },
  { key: "resume", label: "Has resume" },
  { key: "recent", label: "Contacted in last 90 days" },
  { key: "new", label: "Not yet in database" },
] as const;

function StatTile({
  icon: Icon,
  value,
  label,
  onClick,
  active,
}: {
  icon: typeof Users;
  value: string | number;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`text-left rounded-xl border bg-card px-4 py-3.5 transition-colors ${
        active ? "border-primary/60" : "border-border"
      } ${onClick ? "hover:border-primary/40" : ""}`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[11px] truncate">{label}</span>
      </div>
      <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
    </Tag>
  );
}

function PersonCard({
  p,
  onOpen,
  onPromote,
  promoting,
}: {
  p: ArchivePerson;
  onOpen: () => void;
  onPromote: () => void;
  promoting: boolean;
}) {
  const role = txt(p.role);
  const company = txt(p.current_company);
  const where = txt(p.location);
  const pay = lpa(p.salary_min, p.salary_max);
  const initials = (p.name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
      <div className="flex items-start gap-3">
        <button
          onClick={onOpen}
          className="size-9 rounded-full bg-secondary text-xs font-semibold grid place-items-center shrink-0"
        >
          {initials || "?"}
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={onOpen} className="text-left block max-w-full">
            <div className="text-sm font-semibold truncate">{p.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {[role, company].filter(Boolean).join(" · ") || txt(p.email) || "No title captured"}
            </div>
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
            {where && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {where}
              </span>
            )}
            {pay && <span>{pay}</span>}
            {p.resume_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3" /> {p.resume_count} resume{p.resume_count === 1 ? "" : "s"}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3" /> {relTime(p.last_email_at)}
            </span>
          </div>

          {p.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {p.skills.slice(0, 6).map((s) => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary">
                  {s}
                </span>
              ))}
              {p.skills.length > 6 && (
                <span className="text-[10px] text-muted-foreground">+{p.skills.length - 6}</span>
              )}
            </div>
          )}

          {txt(p.ai_summary) && (
            <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
              {txt(p.ai_summary)}
            </p>
          )}
        </div>

        <div className="shrink-0">
          {p.promoted_candidate_id ? (
            <span className="text-[11px] text-success inline-flex items-center gap-1">
              <CheckCircle2 className="size-3.5" /> In database
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={onPromote} disabled={promoting}>
              {promoting ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
              Add
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function RecruitmentMemoryPage() {
  const qc = useQueryClient();
  const { session } = useAuth();
  /** Server fns require a bearer token; skip fetching until the session exists. */
  const authed = !!session;

  const labelsFn = useServerFn(listGmailLabels);
  const progressFn = useServerFn(getImportProgress);
  const startFn = useServerFn(startImportRun);
  const batchFn = useServerFn(processImportBatch);
  const pauseFn = useServerFn(cancelImportRun);
  const resumeFn = useServerFn(resumeImportRun);
  const stopFn = useServerFn(stopImportRun);
  const authUrlFn = useServerFn(startGoogleOAuth);
  const disconnectFn = useServerFn(disconnectGmailAccess);
  const peopleFn = useServerFn(listEmailCandidates);
  const reviewFn = useServerFn(listReviewItems);
  const reviewQueueFn = useServerFn(listReviewQueue);
  const promoteFn = useServerFn(promoteArchivePerson);
  const approveFn = useServerFn(approveReviewItem);
  const rejectFn = useServerFn(rejectReviewItem);
  const rescoreFn = useServerFn(rescoreArchive);
  const clearFn = useServerFn(clearEmailArchive);
  const runsFn = useServerFn(listImportRuns);
  const countsFn = useServerFn(getArchiveCounts);

  const [tab, setTab] = useState<TabKey>("candidates");
  const [search, setSearch] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [open, setOpen] = useState<ArchivePerson | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showBackfill, setShowBackfill] = useState(false);
  const [clearState, setClearState] = useState<{ removed: number; total: number; done: boolean } | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const loopRef = useRef(false);
  const [loopKey, setLoopKey] = useState(0);

  const conn = useQuery({ queryKey: ["gmail-labels"], queryFn: () => labelsFn(), enabled: authed });
  const run = useQuery({
    queryKey: ["email-import-progress"],
    queryFn: () => progressFn(),
    enabled: authed,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 2500 : false),
  });

  const running = run.data?.status === "running";

  const runs = useQuery({ queryKey: ["email-import-runs"], queryFn: () => runsFn(), enabled: authed });

  /** Exact archive totals — the candidate list is paged, so tiles can't count it. */
  const totals = useQuery({
    queryKey: ["email-archive-counts"],
    queryFn: () => countsFn(),
    enabled: authed,
    refetchInterval: running ? 5000 : false,
  });

  /** What history we have already imported, derived from past runs. */
  const coverage = useMemo(() => {
    const done = (runs.data ?? []).filter((r) => r.status !== "failed" && !r.cleared_at);
    if (!done.length) {
      return {
        hasRuns: false,
        entireMailbox: false,
        oldestFrom: null,
        importedThrough: null,
        lastRunAt: null,
        emailsScanned: 0,
      };
    }
    const entireMailbox = done.some((r) => !r.date_from);
    const froms = done.map((r) => r.date_from).filter((d): d is string => !!d);
    const throughs = done.map((r) => r.date_to ?? r.finished_at ?? r.created_at).filter(Boolean) as string[];
    return {
      hasRuns: true,
      entireMailbox,
      oldestFrom: entireMailbox || !froms.length ? null : froms.sort()[0],
      importedThrough: throughs.length ? throughs.sort().slice(-1)[0] : null,
      lastRunAt: done[0].created_at,
      emailsScanned: done.reduce((s, r) => s + (r.emails_scanned ?? 0), 0),
    };
  }, [runs.data]);

  const people = useQuery({
    queryKey: ["email-archive-people", search, chips.join(",")],
    queryFn: () =>
      peopleFn({
        data: {
          search: search.trim() || undefined,
          mine: chips.includes("mine") || undefined,
          contactedWithinDays: chips.includes("recent") ? 90 : undefined,
          reviewStatus: "imported",
        },
      }),
    enabled: authed,
  });

  const reviewItems = useQuery({
    queryKey: ["email-archive-review", "count"],
    queryFn: () => reviewQueueFn({ data: { limit: 1 } }),
    enabled: authed,
  });
  const contextItems = useQuery({
    queryKey: ["email-archive-context"],
    queryFn: () => reviewFn({ data: { status: "skipped", contextOnly: true } }),
    enabled: authed && tab === "history",
  });
  const noCandidate = useQuery({
    queryKey: ["email-archive-nocandidate"],
    queryFn: () => reviewFn({ data: { status: "skipped" } }),
    enabled: authed && tab === "nocandidate",
  });

  /** Drive the batch loop while a run is active. */
  useEffect(() => {
    if (!running || loopRef.current) return;
    loopRef.current = true;
    let stop = false;
    (async () => {
      let failures = 0;
      try {
        // One status read up front; after that the batch result itself tells us
        // whether to keep going, so we spend no round trip per page on polling.
        // Pages stay strictly sequential because each batch advances the run's
        // Gmail page token — overlapping calls would re-scan the same page.
        const first = await progressFn();
        if (first?.status !== "running") return;
        const runId = first.id;
        for (;;) {
          if (stop) break;
          let res: Awaited<ReturnType<typeof batchFn>>;
          try {
            res = await batchFn({ data: { runId } });
            failures = 0;
          } catch (err) {
            // A single flaky batch (network blip, Gmail hiccup) must not end the
            // whole import — back off and retry a few times before giving up.
            failures += 1;
            if (failures >= 5) throw err;
            await new Promise((r) => setTimeout(r, 2000 * failures));
            continue;
          }
          qc.invalidateQueries({ queryKey: ["email-import-progress"] });
          if (res.newPeople.length) {
            qc.invalidateQueries({ queryKey: ["email-archive-people"] });
            qc.invalidateQueries({ queryKey: ["email-archive-counts"] });
          }
          if (res.done) break;
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Import stopped unexpectedly");
      } finally {
        loopRef.current = false;
        qc.invalidateQueries({ queryKey: ["email-import-progress"] });
        qc.invalidateQueries({ queryKey: ["email-archive-people"] });
        qc.invalidateQueries({ queryKey: ["email-archive-review"] });
        qc.invalidateQueries({ queryKey: ["email-archive-counts"] });
      }
    })();
    return () => {
      stop = true;
    };
  }, [running, loopKey, batchFn, progressFn, qc]);

  /**
   * Watchdog: a run stays "running" in the database even if the driving loop
   * died (tab closed, reload, repeated failures). Revive it instead of leaving
   * the import stuck forever.
   */
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      if (!loopRef.current) setLoopKey((v) => v + 1);
    }, 10_000);
    return () => clearInterval(t);
  }, [running]);

  const startMut = useMutation({
    mutationFn: (o: {
      months: number | null;
      dateFrom?: string | null;
      labels: string[];
      exclusions: string[];
    }) => {
      const dateFrom = o.dateFrom
        ? o.dateFrom.slice(0, 10)
        : o.months == null
          ? null
          : new Date(Date.now() - o.months * 30 * 86_400_000).toISOString().slice(0, 10);
      return startFn({ data: { dateFrom, dateTo: null, labels: o.labels, exclusions: o.exclusions } });
    },
    onSuccess: () => {
      toast.success("Importing your recruitment memory…");
      qc.invalidateQueries({ queryKey: ["email-import-progress"] });
      qc.invalidateQueries({ queryKey: ["email-import-runs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start import"),
  });

  const lifecycle = useMutation({
    mutationFn: async (action: "pause" | "resume" | "stop") => {
      const id = run.data?.id;
      if (!id) return;
      if (action === "pause") await pauseFn({ data: { runId: id } });
      if (action === "resume") await resumeFn({ data: { runId: id } });
      if (action === "stop") await stopFn({ data: { runId: id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-import-progress"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  const connect = async () => {
    try {
      const { authUrl } = await authUrlFn({ data: { origin: window.location.origin } });
      window.location.href = authUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start Google connection");
    }
  };

  const promote = async (p: ArchivePerson) => {
    setPromotingId(p.id);
    try {
      const r = await promoteFn({ data: { id: p.id } });
      toast.success(r.alreadyPromoted ? "Already in your candidate database." : `${p.name} added to the database.`);
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add candidate");
    } finally {
      setPromotingId(null);
    }
  };

  const rescore = useMutation({
    mutationFn: () => rescoreFn(),
    onSuccess: (r) => {
      toast.success(`Re-scored ${r.scored ?? 0} archived people.`);
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
      qc.invalidateQueries({ queryKey: ["email-archive-review"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not re-score the archive"),
  });

  /**
   * Clearing thousands of rows takes several round trips, so run it as a loop
   * and keep live counts on screen instead of a silent long request.
   */
  const clear = useMutation({
    mutationFn: async () => {
      let removed = 0;
      let total = 0;
      for (let guard = 0; guard < 200; guard++) {
        const r = await clearFn();
        removed += r.removed ?? 0;
        if (!total) total = removed + (r.remaining ?? 0);
        setClearState({ removed, total: Math.max(total, removed), done: !!r.done });
        qc.invalidateQueries({ queryKey: ["email-archive-counts"] });
        if (r.done) break;
      }
      return { removed };
    },
    onSuccess: (r) => {
      toast.success(`Cleared ${r.removed} archived record${r.removed === 1 ? "" : "s"}.`);
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
      qc.invalidateQueries({ queryKey: ["email-archive-review"] });
      qc.invalidateQueries({ queryKey: ["email-archive-context"] });
      qc.invalidateQueries({ queryKey: ["email-archive-nocandidate"] });
      qc.invalidateQueries({ queryKey: ["email-import-progress"] });
      qc.invalidateQueries({ queryKey: ["email-import-runs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not clear the archive"),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => {
      toast.success("Gmail access removed. Your Google Calendar & Meet sync is untouched.");
      qc.invalidateQueries({ queryKey: ["gmail-labels"] });
      qc.invalidateQueries({ queryKey: ["google-connection"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not disconnect"),
  });

  const reviewMut = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      if (approve) await approveFn({ data: { id } });
      else await rejectFn({ data: { id } });
    },
    onSuccess: (_r, v) => {
      toast.success(v.approve ? "Candidate added to the archive." : "Marked as no candidate.");
      qc.invalidateQueries({ queryKey: ["email-archive-review"] });
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update this item"),
  });

  const visible = useMemo(() => {
    let rows = people.data ?? [];
    if (chips.includes("resume")) rows = rows.filter((p) => p.resume_count > 0);
    if (chips.includes("new")) rows = rows.filter((p) => !p.promoted_candidate_id);
    return rows;
  }, [people.data, chips]);

  const counts = {
    imported: totals.data?.imported ?? people.data?.length ?? 0,
    promoted: totals.data?.promoted ?? (people.data ?? []).filter((p) => p.promoted_candidate_id).length,
    review: reviewItems.data?.bands.total ?? 0,
    conversations: run.data?.skipped_noise ?? 0,
  };
  const connected = !!conn.data?.connected;
  const gmailReady = !!conn.data?.gmail;

  const toggleChip = (k: string) => setChips((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  const items = tab === "history" ? contextItems : noCandidate;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 space-y-8">
        {/* header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <Brain className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Recruitment Memory</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Every candidate you ever emailed, imported from Gmail and made searchable.
              </p>
              {coverage.hasRuns && (
                <p className="text-xs text-muted-foreground mt-1">
                  {coverage.entireMailbox
                    ? "Entire mailbox imported"
                    : coverage.oldestFrom
                      ? `Imported ${new Date(coverage.oldestFrom).toLocaleDateString(undefined, { month: "short", year: "numeric" })} → today`
                      : "History imported"}
                  {coverage.lastRunAt ? ` · last run ${relTime(coverage.lastRunAt)}` : ""}
                  {coverage.emailsScanned ? ` · ${coverage.emailsScanned.toLocaleString()} emails scanned` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
              <Circle
                className={`size-2 ${gmailReady ? "fill-success text-success" : "fill-muted-foreground text-muted-foreground"}`}
              />
              {gmailReady ? (conn.data?.labels.length ? "Gmail connected" : "Gmail connected") : "Gmail not connected"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="size-4" /> Manage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Archive</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                  <History className="size-3.5" /> Import history
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => rescore.mutate()} disabled={rescore.isPending}>
                  <RefreshCw className="size-3.5" /> Re-score archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Danger zone</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setConfirmClear(true)} disabled={clear.isPending}>
                  {clear.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Clearing… {clearState?.removed ?? 0}
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-3.5" /> Clear archive
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => disconnect.mutate()} disabled={!gmailReady || disconnect.isPending}>
                  <Unplug className="size-3.5" /> Disconnect Gmail
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <CandidateSearchPanel authed={authed} gmailReady={gmailReady} onConnect={connect} />

        <div className="space-y-3">
          <button
            onClick={() => setShowBackfill((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <History className="size-3.5" />
            {showBackfill ? "Hide historical import" : "Historical import (index your whole mailbox)"}
            {running ? " · running" : ""}
          </button>

          {(showBackfill || running) && (
            <RecoveryPanel
              connected={connected}
              gmailReady={gmailReady}
              email={run.data?.google_email ?? null}
              run={run.data ?? null}
              labels={conn.data?.labels ?? []}
              starting={startMut.isPending}
              coverage={coverage}
              onConnect={connect}
              onStart={(o) => startMut.mutate(o)}
              onPause={() => lifecycle.mutate("pause")}
              onResume={() => lifecycle.mutate("resume")}
              onStop={() => lifecycle.mutate("stop")}
              onBrowse={() => setTab("candidates")}
              onReview={() => setTab("review")}
            />
          )}
        </div>

        {/* stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatTile icon={Users} value={counts.imported} label="Imported candidates" />
          <StatTile icon={UserPlus} value={counts.promoted} label="Imported to database" />
          <StatTile
            icon={Sparkles}
            value={counts.review}
            label="Needs your call"
            active={tab === "review"}
            onClick={() => setTab("review")}
          />
          <StatTile
            icon={Mail}
            value={counts.conversations}
            label="Recruiting history"
            active={tab === "history"}
            onClick={() => setTab("history")}
          />
          <StatTile icon={History} value={relTime(run.data?.finished_at ?? run.data?.created_at)} label="Last sync" />
        </div>

        {/* tabs */}
        <div className="border-b border-border flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.key === "review" && counts.review > 0 && (
                <span className="ml-1.5 text-[10px] rounded-full bg-warning/15 text-warning px-1.5 py-0.5">
                  {counts.review}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "candidates" ? (
          <section className="space-y-4">
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search anyone you ever recruited — name, company, skill, email, phone, resume text…"
                className="pl-9 h-11"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => toggleChip(f.key)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    chips.includes(f.key)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {people.isLoading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Loading your archive…
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={Users}
                title={search || chips.length ? "Nothing matches that search" : "Your archive is empty for now"}
                description={
                  search || chips.length
                    ? "Try a broader keyword, or clear the quick filters above."
                    : gmailReady
                      ? "Import your recruitment memory above and every candidate we find will appear here."
                      : "Connect Gmail above to start importing candidates from your recruiting history."
                }
                action={
                  search || chips.length ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setChips([]);
                      }}
                    >
                      Clear search
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-3">
                {visible.map((p) => (
                  <PersonCard
                    key={p.id}
                    p={p}
                    onOpen={() => setOpen(p)}
                    onPromote={() => promote(p)}
                    promoting={promotingId === p.id}
                  />
                ))}
              </div>
            )}
          </section>
        ) : tab === "review" ? (
          <ReviewQueue />
        ) : (
          <section className="space-y-3">
            {items.isLoading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : (items.data ?? []).length === 0 ? (
              <EmptyState
                icon={tab === "history" ? Building2 : XCircle}
                title={tab === "history" ? "No recruiting history stored yet" : "Nothing was set aside"}
                description={
                  tab === "history"
                    ? "Recruiter conversations, job descriptions and interview notes we found are kept here as context."
                    : "Emails with no importable candidate profile are logged here so you can audit what we skipped."
                }
              />
            ) : (
              (items.data ?? []).map((it) => (
                <div key={it.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{it.subject ?? "(no subject)"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {it.from_name ?? it.from_email ?? "Unknown sender"} · {relTime(it.sent_at)}
                      </div>
                    </div>
                    <OutcomeBadge
                      artifact={it.artifact_type}
                      score={it.confidence}
                      state={it.status === "needs_review" ? "needs_review" : "skipped"}
                    />
                  </div>
                  {it.snippet && <p className="text-[11px] text-muted-foreground line-clamp-2">{it.snippet}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{KIND_LABEL[it.email_kind ?? "other"] ?? "Other"}</span>
                    {it.attachment_names.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="size-3" /> {it.attachment_names.join(", ")}
                      </span>
                    )}
                  </div>
                  {txt(it.reason) && <p className="text-[11px] text-muted-foreground">{txt(it.reason)}</p>}
                </div>
              ))
            )}
          </section>
        )}
      </div>

      <PersonSheet person={open} onClose={() => setOpen(null)} />
      <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />

      <AlertDialog open={confirmClear} onOpenChange={(o) => !clear.isPending && setConfirmClear(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{clear.isPending ? "Clearing your archive…" : "Clear the imported archive?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {clear.isPending
                ? "This runs in batches and can take a minute on large archives. Keep this page open until it finishes."
                : "This removes archived people, their stored emails and resume versions. Anyone you already added to the candidate database keeps their candidate record. You can import your memory again at any time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {clear.isPending && (
            <div className="space-y-2">
              <Progress
                value={
                  clearState && clearState.total > 0
                    ? Math.min(99, Math.round((clearState.removed / clearState.total) * 100))
                    : 5
                }
              />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Removed {clearState?.removed ?? 0}
                {clearState && clearState.total > 0 ? ` of ${clearState.total}` : ""} archived people…
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clear.isPending}>Keep archive</AlertDialogCancel>
            <AlertDialogAction
              disabled={clear.isPending}
              onClick={(e) => {
                e.preventDefault();
                setClearState({ removed: 0, total: 0, done: false });
                clear.mutate(undefined, { onSettled: () => setConfirmClear(false) });
              }}
            >
              {clear.isPending ? "Clearing…" : "Clear archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}