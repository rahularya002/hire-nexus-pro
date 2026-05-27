import { Sparkles, Loader2, Briefcase, Building2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoutCandidate } from "@/lib/scout-match.functions";

export function ScoutResults({
  loading,
  error,
  candidates,
}: {
  loading: boolean;
  error: string | null;
  candidates: ScoutCandidate[] | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5 border-b border-border flex items-center gap-2">
        <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">AI Talent Scout matches</div>
          <div className="text-xs text-muted-foreground">Generated from the role brief — review and shortlist.</div>
        </div>
      </div>

      {loading && (
        <div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Sourcing matched candidates...
        </div>
      )}

      {error && !loading && (
        <div className="m-5 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm px-3 py-2">{error}</div>
      )}

      {!loading && candidates && candidates.length > 0 && (
        <ul className="divide-y divide-border">
          {candidates.map((c, i) => (
            <li key={i} className="p-5 flex flex-col sm:flex-row sm:items-start gap-4 hover:bg-secondary/40 transition">
              <div className="size-10 shrink-0 rounded-full bg-gradient-to-br from-info to-purple text-primary-foreground grid place-items-center text-sm font-semibold">
                {c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium truncate">{c.name}</div>
                  <ScoreBadge score={c.matchScore} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1"><Briefcase className="size-3" /> {c.title}</span>
                  <span className="inline-flex items-center gap-1"><Building2 className="size-3" /> {c.currentCompany}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {c.location}</span>
                  <span>{c.experience}</span>
                </div>
                <p className="text-xs text-foreground/80 mt-2">{c.reasoning}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.highlights.map((h) => (
                    <span key={h} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-foreground/80 border border-border">{h}</span>
                  ))}
                </div>
              </div>
              <div className="flex sm:flex-col gap-2 shrink-0">
                <button type="button" className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">Shortlist</button>
                <button type="button" className="h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-secondary">Skip</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && candidates && candidates.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">No matches generated yet.</div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 90
      ? "bg-success/15 text-success border-success/25"
      : score >= 75
        ? "bg-info/15 text-info border-info/25"
        : "bg-warning/20 text-warning border-warning/25";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border tabular-nums", tone)}>
      {score}% match
    </span>
  );
}