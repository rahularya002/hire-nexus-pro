import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  Mail,
  Pause,
  Play,
  Search,
  Sparkles,
  Square,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { fmtDate } from "./shared";
import type { ImportRun } from "@/lib/email-import.functions";

type Window = { key: string; label: string; months: number | null; recommended?: boolean };

/** What history has already been imported, derived from past runs. */
export type Coverage = {
  hasRuns: boolean;
  /** true when a past run scanned the whole mailbox (no date_from). */
  entireMailbox: boolean;
  /** oldest date we have imported from (ISO date), null when entire mailbox. */
  oldestFrom: string | null;
  /** we have imported mail up to this point (ISO datetime). */
  importedThrough: string | null;
  lastRunAt: string | null;
  emailsScanned: number;
};

const WINDOWS: Window[] = [
  { key: "3m", label: "Last 3 months", months: 3 },
  { key: "12m", label: "Last 12 months", months: 12 },
  { key: "3y", label: "Last 3 years", months: 36 },
  { key: "all", label: "Entire mailbox", months: null, recommended: true },
];

/** Rough, clearly-labelled forecast so nobody starts an import blind. */
function estimate(months: number | null) {
  const m = months ?? 72;
  const emails = Math.round(m * 420);
  const candidates = Math.round(emails * 0.055);
  const minutes = Math.max(1, Math.round(emails / 260));
  const duration =
    minutes < 60 ? `~${minutes} min` : `~${Math.round((minutes / 60) * 10) / 10} hr`;
  return { emails, candidates, duration };
}

const nf = new Intl.NumberFormat();

function Metric({ value, label, hint }: { value: number | string; label: string; hint?: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <div className="text-xl font-semibold tabular-nums">{typeof value === "number" ? nf.format(value) : value}</div>
      <div className="text-[11px] text-muted-foreground truncate">{label}</div>
    </div>
  );
}

function elapsedOf(from?: string | null) {
  if (!from) return "0:00";
  const s = Math.max(0, Math.round((Date.now() - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function RecoveryPanel({
  connected,
  gmailReady,
  email,
  run,
  labels,
  starting,
  coverage,
  onConnect,
  onStart,
  onPause,
  onResume,
  onStop,
  onBrowse,
  onReview,
}: {
  connected: boolean;
  gmailReady: boolean;
  email: string | null;
  run: ImportRun | null;
  labels: { id: string; name: string }[];
  starting: boolean;
  coverage: Coverage;
  onConnect: () => void;
  onStart: (o: {
    months: number | null;
    dateFrom?: string | null;
    labels: string[];
    exclusions: string[];
  }) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onBrowse: () => void;
  onReview: () => void;
}) {
  const incrementalAvailable = coverage.hasRuns && !!coverage.importedThrough;
  const [win, setWin] = useState(incrementalAvailable ? "since" : "all");
  const [advanced, setAdvanced] = useState(false);
  const [selLabels, setSelLabels] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState("");
  const [setupAgain, setSetupAgain] = useState(false);
  const [, tick] = useState(0);

  const running = run?.status === "running";
  const paused = run?.status === "paused";
  const completed = run?.status === "completed" || run?.status === "cancelled";

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const chosen = WINDOWS.find((w) => w.key === win) ?? WINDOWS[3];
  const est = useMemo(() => estimate(chosen.months), [chosen.months]);
  const isIncremental = win === "since" && incrementalAvailable;

  /** Months of history already covered (Infinity when the whole mailbox was scanned). */
  const coveredMonths = coverage.entireMailbox
    ? Number.POSITIVE_INFINITY
    : coverage.oldestFrom
      ? Math.max(0, (Date.now() - new Date(coverage.oldestFrom).getTime()) / (30 * 86_400_000))
      : 0;

  const incrementalMonths = coverage.importedThrough
    ? Math.max(
        0.05,
        (Date.now() - new Date(coverage.importedThrough).getTime()) / (30 * 86_400_000),
      )
    : 0;

  const coverageLine = !coverage.hasRuns
    ? null
    : coverage.entireMailbox
      ? `Entire mailbox already imported${coverage.importedThrough ? ` · up to ${fmtDate(coverage.importedThrough)}` : ""}`
      : coverage.oldestFrom
        ? `Already imported: ${fmtDate(coverage.oldestFrom)} → ${fmtDate(coverage.importedThrough)}`
        : `Last import finished ${fmtDate(coverage.importedThrough)}`;

  const advancedSummary = `${selLabels.length ? `${selLabels.length} folder${selLabels.length === 1 ? "" : "s"}` : "All folders"} · ${
    exclusions.trim() ? "custom exclusions" : "no exclusions"
  }`;

  /** Incremental runs only look at mail newer than the last import. */
  const shownEst = isIncremental ? estimate(incrementalMonths) : est;

  const shell = "rounded-2xl border border-border bg-card p-6 sm:p-7";

  /* ---------------------------------------------------- not connected */
  if (!connected || !gmailReady) {
    return (
      <div className={shell}>
        <div className="max-w-xl space-y-4">
          <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Mail className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {connected ? "One more permission and we can begin" : "Import the candidates you already know"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {connected
                ? "Your Google account is connected for calendar only. Grant read-only Gmail access so we can read your recruiting history."
                : "Years of resumes, referrals and candidate conversations are sitting in your inbox. Connect Gmail and we turn that history into a searchable archive — read-only, and we never send mail on your behalf."}
            </p>
          </div>
          <Button size="lg" onClick={onConnect}>
            {connected ? "Reconnect Google" : "Connect Gmail"}
          </Button>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------- running / paused */
  if (running || paused) {
    const scanned = run?.emails_scanned ?? 0;
    const target = estimate(null).emails;
    const pct = Math.min(96, Math.max(4, Math.round((scanned / Math.max(target, 1)) * 100)));
    return (
      <div className={shell}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            {running ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <Pause className="size-4 text-muted-foreground" />
            )}
            <div>
              <div className="text-sm font-semibold">
                {running ? "Importing your recruitment memory" : "Import paused"}
              </div>
              <div className="text-xs text-muted-foreground">{run?.google_email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {running ? (
              <Button variant="outline" size="sm" onClick={onPause}>
                <Pause className="size-3.5" /> Pause
              </Button>
            ) : (
              <Button size="sm" onClick={onResume}>
                <Play className="size-3.5" /> Resume
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onStop}>
              <Square className="size-3.5" /> Stop
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <Progress value={running ? pct : Math.max(4, pct)} className="h-1.5" />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{running ? "Scanning your mailbox…" : "Paused — progress is saved."}</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="size-3" /> {elapsedOf(run?.created_at)}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          <Metric value={run?.emails_scanned ?? 0} label="Emails scanned" />
          <Metric value={run?.people_found ?? 0} label="Candidates imported" />
          <Metric
            value={run?.people_enriched ?? 0}
            label="Merged into existing"
            hint="Emails that matched someone already in your archive and were added to their timeline instead of creating a duplicate."
          />
          <Metric value={run?.needs_review ?? 0} label="Need your call" />
          <Metric value={run?.skipped_noise ?? run?.skipped_non_resume ?? 0} label="No candidate found" />
        </div>

        <details className="mt-5 group">
          <summary className="cursor-pointer text-[11px] text-muted-foreground inline-flex items-center gap-1 select-none">
            <ChevronDown className="size-3 transition-transform group-open:rotate-180" /> Processing details
          </summary>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
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
            {!!run?.failures && <span>{run.failures} email(s) could not be read</span>}
          </div>
        </details>
      </div>
    );
  }

  /* ------------------------------------------------------- completed */
  if (completed && !setupAgain) {
    return (
      <div className={shell}>
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-success/10 text-success grid place-items-center shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">Your recruitment memory is ready</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Finished {fmtDate(run?.finished_at ?? run?.created_at)} · {run?.google_email}
            </p>
            {coverageLine && <p className="text-xs text-muted-foreground mt-1">{coverageLine}</p>}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          <Metric value={run?.emails_scanned ?? 0} label="Emails scanned" />
          <Metric value={run?.people_found ?? 0} label="Candidates imported" />
          <Metric
            value={run?.people_enriched ?? 0}
            label="Merged into existing"
            hint="Emails that matched someone already in your archive and were added to their timeline instead of creating a duplicate."
          />
          <Metric value={run?.needs_review ?? 0} label="Need your call" />
          <Metric value={run?.skipped_noise ?? run?.skipped_non_resume ?? 0} label="No candidate found" />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={onBrowse}>
            <Search className="size-4" /> Browse imported candidates
          </Button>
          {!!run?.needs_review && (
            <Button variant="outline" onClick={onReview}>
              Review {run.needs_review} item{run.needs_review === 1 ? "" : "s"}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setSetupAgain(true)}>
            Import more history
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------ idle */
  return (
    <div className={shell}>
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="max-w-xl">
          <h2 className="text-lg font-semibold tracking-tight">Import Recruitment Memory</h2>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            We read your recruiting history in {email ? <span className="text-foreground">{email}</span> : "Gmail"},
            detect the emails that actually contain a candidate profile, and build a searchable archive — separate
            from your candidate database until you promote someone.
          </p>
          <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
            {[
              [Mail, "Scan years of email and attachments, read-only"],
              [Users, "Detect real candidate profiles, skip the noise"],
              [Search, "Search everything you ever recruited, instantly"],
            ].map(([Icon, text]) => {
              const I = Icon as typeof Mail;
              return (
                <li key={text as string} className="flex items-center gap-2">
                  <I className="size-3.5 text-primary shrink-0" /> {text as string}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <Label className="text-xs text-muted-foreground">How much history should we import?</Label>
        {coverageLine && (
          <div className="rounded-xl border border-border bg-background/60 px-4 py-3 text-xs text-muted-foreground">
            <div className="text-foreground font-medium">{coverageLine}</div>
            <div className="mt-0.5">
              {coverage.emailsScanned ? `${nf.format(coverage.emailsScanned)} emails scanned so far · ` : ""}
              Re-running is safe — emails we already processed are skipped, so nothing is imported or analysed twice.
            </div>
          </div>
        )}
        {incrementalAvailable && (
          <button
            onClick={() => setWin("since")}
            className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
              win === "since" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 bg-background"
            }`}
          >
            <div className="text-sm font-medium">New mail since last import</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Fastest — only looks at mail after {fmtDate(coverage.importedThrough)}
            </div>
          </button>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {WINDOWS.map((w) => {
            const wMonths = w.months ?? Number.POSITIVE_INFINITY;
            const fullyCovered = coverage.hasRuns && wMonths <= coveredMonths;
            const extraMonths = Number.isFinite(wMonths) ? wMonths - coveredMonths : null;
            const addsHistory =
              coverage.hasRuns && !fullyCovered
                ? extraMonths == null
                  ? "Adds everything older than what you have"
                  : extraMonths >= 12
                    ? `Adds ~${Math.round(extraMonths / 12)} more year${Math.round(extraMonths / 12) === 1 ? "" : "s"} of history`
                    : `Adds ~${Math.max(1, Math.round(extraMonths))} more months of history`
                : null;
            return (
              <button
                key={w.key}
                onClick={() => setWin(w.key)}
                className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                  win === w.key
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 bg-background"
                } ${fullyCovered && win !== w.key ? "opacity-60" : ""}`}
              >
                <div className="text-sm font-medium flex items-center gap-2">
                  <span className="truncate">{w.label}</span>
                  {fullyCovered && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-success/25 bg-success/10 text-success shrink-0">
                      Imported
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {fullyCovered
                    ? "Already covered — re-running just re-checks"
                    : (addsHistory ??
                      (w.recommended
                        ? "Recommended — deepest memory"
                        : `≈ ${nf.format(estimate(w.months).emails)} emails`))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-3 flex flex-wrap gap-x-8 gap-y-2">
          <Metric value={shownEst.emails} label="Emails to scan (est.)" />
          <Metric value={shownEst.candidates} label="Candidate profiles (est.)" />
          <Metric value={shownEst.duration} label="Time to finish (est.)" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Estimates only — import runs in the background and you can pause or stop it at any time.
        </p>
      </div>

      <div className="mt-5">
        <button
          onClick={() => setAdvanced((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <Filter className="size-3.5" />
          Advanced options
          <span className="text-[11px] opacity-70">({advancedSummary})</span>
          <ChevronDown className={`size-3.5 transition-transform ${advanced ? "rotate-180" : ""}`} />
        </button>
        {advanced && (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Limit to folders / labels</Label>
              <select
                multiple
                value={selLabels}
                onChange={(e) => setSelLabels(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className="min-h-[92px] w-full rounded-lg border border-border bg-background px-2 py-1 text-sm"
              >
                {labels.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">Leave empty to scan the whole mailbox.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Exclude senders or domains</Label>
              <Input
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
                placeholder="naukri.com, no-reply@linkedin.com"
              />
              <p className="text-[11px] text-muted-foreground">Comma separated. Job alerts are already filtered.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          disabled={starting}
          onClick={() =>
            onStart({
              months: chosen.months,
              dateFrom: isIncremental ? (coverage.importedThrough ?? null) : undefined,
              labels: selLabels,
              exclusions: exclusions
                .split(/[\n,]/)
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        >
          {starting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Import Recruitment Memory
        </Button>
        {completed && (
          <Button variant="ghost" onClick={() => setSetupAgain(false)}>
            Back to last summary
          </Button>
        )}
      </div>
    </div>
  );
}