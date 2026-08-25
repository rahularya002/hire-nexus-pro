// Natural-language candidate search. This panel is only the query surface: the
// matches themselves are rendered as rows inside the Candidate Grid below, so
// the grid stays the single source of truth on this screen.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCandidateSearch,
  listRecentSearches,
  runCandidateSearchBatch,
  startCandidateSearch,
} from "@/lib/search/search.functions";
import { setActiveSearch, setSearchQuery, useSearchSession } from "@/lib/search/search-session";

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

  // Query + active search live outside the component so a tab switch (which
  // unmounts this panel) cannot throw the recruiter's work away.
  const { query, searchId } = useSearchSession();
  const setQuery = setSearchQuery;
  const [scanning, setScanning] = useState(false);
  const loopRef = useRef(false);

  const recent = useQuery({ queryKey: ["candidate-searches"], queryFn: () => recentFn(), enabled: authed });
  const result = useQuery({
    queryKey: ["candidate-search", searchId],
    queryFn: () => getFn({ data: { searchId: searchId! } }),
    enabled: authed && !!searchId,
    refetchInterval: scanning ? 2000 : false,
    staleTime: 5 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
      // A new search replaces whatever the grid was showing before.
      setActiveSearch(res.searchId);
      await qc.invalidateQueries({ queryKey: ["candidate-search", res.searchId] });
      if (gmailReady) void drive(res.searchId);
    },
    onError: (e) => toast.error(searchError(e)),
  });

  useEffect(() => {
    if (!searchId) return;
    // A page refresh mid-search should pick the loop back up.
    if (result.data?.search?.status === "running" && !loopRef.current && gmailReady) void drive(searchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.data?.search?.status, searchId, gmailReady]);

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
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
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
        <Button
          className="h-11 sm:w-40"
          onClick={submit}
          disabled={start.isPending || scanning || gmailChecking || query.trim().length < 3}
        >
          {start.isPending || scanning ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {scanning ? "Searching…" : "Search candidates"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Describe who you need — matches filter the candidate grid below.
      </p>

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
              onClick={() => setActiveSearch(r.id, r.raw_query)}
              className="text-[11px] rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {r.raw_query.slice(0, 40)}
              {r.raw_query.length > 40 ? "…" : ""} <ArrowRight className="size-3" />
            </button>
          ))}
        </div>
      )}

      {result.data?.search?.status === "failed" && !scanning && (
        <p className="text-sm text-destructive">
          This search stopped early. Your Gmail connection may need reconnecting — try running it again.
        </p>
      )}

      {searchId && result.data?.search?.status === "running" && !scanning && gmailReady && (
        <Button size="sm" variant="outline" onClick={() => void drive(searchId)}>
          Keep searching older mail
        </Button>
      )}
    </section>
  );
}
