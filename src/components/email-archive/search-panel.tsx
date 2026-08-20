// Search-first entry point: ask for people in plain English, retrieve only the
// mail that could match, and save the ones the recruiter picks.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  FileSearch,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Search,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { relTime } from "@/components/email-archive/shared";
import { ThreadSheet } from "@/components/email-archive/mailbox-panel";
import {
  dismissSearchHit,
  getCandidateSearch,
  getHitSourceUrl,
  getSearchHitResumeUrl,
  listSearchHitSources,
  listRecentSearches,
  runCandidateSearchBatch,
  saveSearchHit,
  startCandidateSearch,
  type SearchHit,
} from "@/lib/search/search.functions";
import { evidenceChips, sourceLabel, sourceState } from "@/lib/search/evidence";

const EXAMPLES = [
  "Fashion designers with 3+ years experience in Delhi or Mumbai",
  "Backend engineers who know Node and Postgres, 5+ years, Bengaluru",
  "HR generalists in Pune under 12 LPA",
];

function searchError(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("GMAIL_SCOPE") || m.includes("NO_GMAIL_SCOPE")) {
    return "Reconnect Google and grant read-only Gmail access.";
  }
  if (m.includes("GMAIL_AUTH") || m.includes("NOT_CONNECTED")) {
    return "Gmail rejected the request — reconnect your Google account.";
  }
  if (m.includes("GMAIL_RATE_LIMIT")) return "Gmail is rate limiting us — results may be partial. Try again shortly.";
  if (m.includes("GMAIL_UNAVAILABLE")) return "Gmail is temporarily unavailable — try again in a moment.";
  return m;
}

function ScoreRing({ score }: { score: number }) {
  const tone = score >= 70 ? "text-success" : score >= 45 ? "text-warning" : "text-muted-foreground";
  return (
    <div className={`shrink-0 grid place-items-center size-11 rounded-full border border-border ${tone}`}>
      <span className="text-sm font-semibold tabular-nums">{score}</span>
    </div>
  );
}

/** All sources behind one result: mail, stored resumes and their evidence text. */
function EvidenceSheet({
  hit,
  onClose,
  onOpenThread,
}: {
  hit: SearchHit | null;
  onClose: () => void;
  onOpenThread: (threadId: string) => void;
}) {
  const listFn = useServerFn(listSearchHitSources);
  const urlFn = useServerFn(getHitSourceUrl);
  const q = useQuery({
    queryKey: ["search-hit-sources", hit?.id],
    queryFn: () => listFn({ data: { hitId: hit!.id } }),
    enabled: !!hit,
  });

  const openFile = async (storagePath: string) => {
    try {
      const { url } = await urlFn({ data: { hitId: hit!.id, storagePath } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open this file");
    }
  };

  const sources = q.data?.sources ?? [];

  return (
    <Sheet open={!!hit} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-8 text-base">
            Candidate details — {hit?.extracted?.name || hit?.from_name || hit?.from_email || "Candidate"}
          </SheetTitle>
        </SheetHeader>

        {q.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading sources…
          </p>
        ) : sources.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No source email or attachment is available for this result, so it cannot be verified here.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {sources.map((s, idx) => (
              <article key={`${s.kind}-${s.storagePath ?? idx}`} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate inline-flex items-center gap-1.5">
                      {s.kind === "email" ? <Mail className="size-3.5" /> : <FileText className="size-3.5" />}
                      {s.fileName || s.subject || "(no subject)"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[s.fromEmail, s.subject, s.date ? relTime(s.date) : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {s.gmailThreadId && (
                      <Button size="sm" variant="outline" onClick={() => onOpenThread(s.gmailThreadId!)}>
                        <Mail className="size-3.5" /> Open email
                      </Button>
                    )}
                    {s.storagePath && (
                      <Button size="sm" variant="outline" onClick={() => openFile(s.storagePath!)}>
                        <FileText className="size-3.5" /> View file
                      </Button>
                    )}
                  </div>
                </div>
                {s.excerpt && (
                  <p className="text-xs text-muted-foreground line-clamp-6 whitespace-pre-wrap">{s.excerpt}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function HitCard({
  hit,
  onSave,
  onDismiss,
  onOpenThread,
  onOpenEvidence,
  saving,
}: {
  hit: SearchHit;
  onSave: () => void;
  onDismiss: () => void;
  onOpenThread: (threadId: string) => void;
  onOpenEvidence: () => void;
  saving: boolean;
}) {
  const resumeFn = useServerFn(getSearchHitResumeUrl);
  const ex = hit.extracted ?? {};
  const missing = hit.score_parts?.missing ?? [];
  const state = sourceState(hit);
  const chips = evidenceChips(hit);

  const openResume = async () => {
    try {
      const { url } = await resumeFn({ data: { hitId: hit.id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the resume");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex gap-4">
      <ScoreRing score={hit.score} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="font-medium truncate">{ex.name || hit.from_name || hit.from_email || "Unknown"}</div>
            <div className="text-xs text-muted-foreground truncate">
              {[ex.role, ex.current_company, ex.experience].filter(Boolean).join(" · ") || "Role not stated"}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {state === "email" ? (
              <Button size="sm" variant="outline" onClick={() => onOpenThread(hit.gmail_thread_id!)}>
                <Mail className="size-3.5" /> {sourceLabel(state)}
              </Button>
            ) : state === "attachment" ? (
              <Button size="sm" variant="outline" onClick={openResume}>
                <FileText className="size-3.5" /> {sourceLabel(state)}
              </Button>
            ) : state === "multiple" ? (
              <Button size="sm" variant="outline" onClick={onOpenEvidence}>
                <FileSearch className="size-3.5" /> {sourceLabel(state)}
              </Button>
            ) : null}
            {hit.saved_at ? (
              <span className="text-xs text-success inline-flex items-center gap-1">
                <Check className="size-3.5" /> Saved
              </span>
            ) : (
              <>
                <Button size="sm" onClick={onSave} disabled={saving}>
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                  Add to database
                </Button>
                <Button size="sm" variant="ghost" onClick={onDismiss} aria-label="Dismiss result">
                  <X className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {ex.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {ex.location}
            </span>
          )}
          {hit.origin === "archive" ? (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="size-3" /> Already in your memory
            </span>
          ) : (
            <span className="truncate max-w-[26rem]">
              {hit.subject || "(no subject)"} · {relTime(hit.sent_at)}
            </span>
          )}
          {hit.resume_file_name && (
            <button onClick={openResume} className="inline-flex items-center gap-1 text-primary hover:underline">
              <FileText className="size-3" /> {hit.resume_file_name}
            </button>
          )}
        </div>

        {(chips.length > 0 || missing.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={`${c.kind}-${c.label}`}
                className="text-[11px] rounded-full border border-success/40 text-success px-2 py-0.5"
              >
                {c.label}
              </span>
            ))}
            {missing.map((m) => (
              <span key={m} className="text-[11px] rounded-full border border-border text-muted-foreground px-2 py-0.5">
                {m}
              </span>
            ))}
            {state === "none" && (
              <span className="text-[11px] rounded-full border border-border text-muted-foreground px-2 py-0.5">
                unverified — no source
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CandidateSearchPanel({
  authed,
  gmailReady,
  gmailChecking,
  onConnect,
}: {
  authed: boolean;
  gmailReady: boolean;
  /** True while we are still asking Gmail whether this account is connected. */
  gmailChecking?: boolean;
  onConnect: () => void;
}) {
  const qc = useQueryClient();
  const startFn = useServerFn(startCandidateSearch);
  const batchFn = useServerFn(runCandidateSearchBatch);
  const getFn = useServerFn(getCandidateSearch);
  const recentFn = useServerFn(listRecentSearches);
  const saveFn = useServerFn(saveSearchHit);
  const dismissFn = useServerFn(dismissSearchHit);

  const [query, setQuery] = useState("");
  const [searchId, setSearchId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [evidenceHit, setEvidenceHit] = useState<SearchHit | null>(null);
  const loopRef = useRef(false);

  const recent = useQuery({ queryKey: ["candidate-searches"], queryFn: () => recentFn(), enabled: authed });
  const result = useQuery({
    queryKey: ["candidate-search", searchId],
    queryFn: () => getFn({ data: { searchId: searchId! } }),
    enabled: authed && !!searchId,
    refetchInterval: scanning ? 2000 : false,
  });

  /** Drive Gmail retrieval in slices so results stream in instead of blocking. */
  const drive = async (id: string) => {
    if (loopRef.current) return;
    loopRef.current = true;
    setScanning(true);
    try {
      for (let i = 0; i < 20; i++) {
        const res = await batchFn({ data: { searchId: id } });
        await qc.invalidateQueries({ queryKey: ["candidate-search", id] });
        if (res.done) break;
      }
    } catch (e) {
      toast.error(searchError(e));
    } finally {
      loopRef.current = false;
      setScanning(false);
      qc.invalidateQueries({ queryKey: ["candidate-searches"] });
    }
  };

  const start = useMutation({
    mutationFn: async () => startFn({ data: { query: query.trim(), labels: [] } }),
    onSuccess: async (res) => {
      setSearchId(res.searchId);
      await qc.invalidateQueries({ queryKey: ["candidate-search", res.searchId] });
      if (gmailReady) void drive(res.searchId);
    },
    onError: (e) => toast.error(searchError(e)),
  });

  const save = useMutation({
    mutationFn: async (hitId: string) => saveFn({ data: { hitId, toCandidateDb: true } }),
    onMutate: (hitId) => setSavingId(hitId),
    onSettled: () => setSavingId(null),
    onSuccess: () => {
      toast.success("Added to your candidate database");
      qc.invalidateQueries({ queryKey: ["candidate-search", searchId] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["email-archive-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save this candidate"),
  });

  const dismiss = useMutation({
    mutationFn: async (hitId: string) => dismissFn({ data: { hitId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidate-search", searchId] }),
  });

  useEffect(() => {
    if (!searchId) return;
    // A page refresh mid-search should pick the loop back up.
    if (result.data?.search?.status === "running" && !loopRef.current && gmailReady) void drive(searchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.data?.search?.status, searchId, gmailReady]);

  const hits = result.data?.hits ?? [];
  const search = result.data?.search ?? null;
  const submit = () => {
    if (query.trim().length < 3) return;
    // Never bounce to Google while the connection check is still in flight —
    // that hijacked the page to OAuth for already-connected recruiters.
    if (gmailChecking) return;
    if (!gmailReady) {
      onConnect();
      return;
    }
    start.mutate();
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight inline-flex items-center gap-2">
          <Search className="size-4 text-primary" /> Find candidates in your inbox
        </h2>
        <p className="text-sm text-muted-foreground">
          Describe who you need. We search only the mail that could match — nothing else is downloaded.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Fashion designers with 3+ years experience in Delhi or Mumbai"
          className="h-11"
        />
        <Button className="h-11 sm:w-40" onClick={submit} disabled={start.isPending || scanning || gmailChecking || query.trim().length < 3}>
          {start.isPending || scanning ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {scanning ? "Searching…" : "Search"}
        </Button>
      </div>

      {!gmailReady && !gmailChecking && (
        <p className="text-xs text-muted-foreground">
          Connect Gmail once to search your mail history.{" "}
          <button onClick={onConnect} className="text-primary hover:underline">
            Connect Gmail
          </button>
        </p>
      )}

      {!searchId && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => setQuery(e)}
              className="text-xs rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {!!(recent.data ?? []).length && !searchId && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">Recent:</span>
          {(recent.data ?? []).slice(0, 4).map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setQuery(r.raw_query);
                setSearchId(r.id);
              }}
              className="text-[11px] rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {r.raw_query.slice(0, 40)}
              {r.raw_query.length > 40 ? "…" : ""} <ArrowRight className="size-3" />
            </button>
          ))}
        </div>
      )}

      {searchId && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground flex-wrap">
            <span>
              {hits.length} {hits.length === 1 ? "match" : "matches"}
              {search ? ` · ${search.hydrated_count} emails read · ${search.ai_calls} AI calls` : ""}
              {scanning ? " · still searching" : ""}
            </span>
            <button
              onClick={() => {
                setSearchId(null);
                setQuery("");
              }}
              className="hover:text-foreground"
            >
              Clear results
            </button>
          </div>

          {hits.length === 0 && !scanning && (
            <p className="text-sm text-muted-foreground">
              No candidates matched this query yet. Try fewer constraints, or run a historical import below so older mail
              is already indexed.
            </p>
          )}

          {search?.status === "failed" && !scanning && (
            <p className="text-sm text-destructive">
              This search stopped early. Your Gmail connection may need reconnecting — try running it again.
            </p>
          )}

          {search?.status === "running" && !scanning && gmailReady && (
            <Button size="sm" variant="outline" onClick={() => void drive(searchId)}>
              Keep searching older mail
            </Button>
          )}

          <div className="space-y-2.5">
            {hits.map((h) => (
              <HitCard
                key={h.id}
                hit={h}
                saving={savingId === h.id}
                onSave={() => save.mutate(h.id)}
                onDismiss={() => dismiss.mutate(h.id)}
                onOpenThread={setThreadId}
                onOpenEvidence={() => setEvidenceHit(h)}
              />
            ))}
          </div>

          {scanning && (
            <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Reading matching emails…
            </div>
          )}
        </div>
      )}

      <ThreadSheet threadId={threadId} onClose={() => setThreadId(null)} />
      <EvidenceSheet hit={evidenceHit} onClose={() => setEvidenceHit(null)} onOpenThread={setThreadId} />
    </section>
  );
}