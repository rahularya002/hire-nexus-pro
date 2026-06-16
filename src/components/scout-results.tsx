import { Sparkles, Loader2, Briefcase, Building2, MapPin, Mail, Phone, ExternalLink, Linkedin, Github, Database, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourcedMatchView } from "@/lib/apify.functions";

export function ScoutResults({
  loading,
  error,
  candidates,
  label,
  onShortlist,
  onReject,
  busyId,
}: {
  loading: boolean;
  error: string | null;
  candidates: SourcedMatchView[] | null;
  label?: string;
  onShortlist?: (m: SourcedMatchView) => void;
  onReject?: (m: SourcedMatchView) => void;
  busyId?: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5 border-b border-border flex items-center gap-2">
        <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">AI Talent Scout matches</div>
          <div className="text-xs text-muted-foreground">{label ?? "Review and shortlist."}</div>
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
          {candidates.map((c) => (
            <li key={c.sourcedCandidateId} className="p-5 flex flex-col sm:flex-row sm:items-start gap-4 hover:bg-secondary/40 transition">
              <div className="size-10 shrink-0 rounded-full bg-gradient-to-br from-info to-purple text-primary-foreground grid place-items-center text-sm font-semibold">
                {c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium truncate">{c.name}</div>
                  {c.matchScore != null && <ScoreBadge score={c.matchScore} />}
                  <SourceBadge source={c.source} origin={c.origin} />
                  {c.openToWork && (
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                      Open to work
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1"><Briefcase className="size-3" /> {c.headline ?? "—"}</span>
                  <span className="inline-flex items-center gap-1"><Building2 className="size-3" /> {c.currentCompany ?? "—"}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {c.location ?? "—"}</span>
                  <span>{c.experienceYears != null ? `${c.experienceYears}y` : "—"}</span>
                </div>
                {c.reasoning && <p className="text-xs text-foreground/80 mt-2">{c.reasoning}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.skills.slice(0, 8).map((h) => (
                    <span key={h} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-foreground/80 border border-border">{h}</span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="size-3" />{c.email}</a>}
                  {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="size-3" />{c.phone}</a>}
                  {c.profileUrl && (
                    <a href={c.profileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                      {c.source === "linkedin" ? <Linkedin className="size-3 text-[#0A66C2]" /> : <ExternalLink className="size-3" />}
                      {c.source === "linkedin" ? "Message on LinkedIn" : "Profile"}
                    </a>
                  )}
                  {!c.email && !c.phone && !c.profileUrl && <span className="italic">No public contact info</span>}
                </div>
              </div>
              <div className="flex sm:flex-col gap-2 shrink-0">
                <button
                  type="button"
                  disabled={!onShortlist || busyId === c.sourcedCandidateId}
                  onClick={() => onShortlist?.(c)}
                  className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {busyId === c.sourcedCandidateId ? <Loader2 className="size-3 animate-spin" /> : "Shortlist"}
                </button>
                <button
                  type="button"
                  disabled={!onReject || busyId === c.sourcedCandidateId}
                  onClick={() => onReject?.(c)}
                  className="h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-secondary disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <X className="size-3" /> Reject
                </button>
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

function SourceBadge({ source, origin }: { source: string; origin: "internal" | "apify" }) {
  const Icon = source === "linkedin" ? Linkedin : source === "github" ? Github : Database;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-border bg-secondary/60 text-muted-foreground uppercase tracking-wide">
      <Icon className="size-3" />
      {source}
      {origin === "internal" && <span className="ml-1 text-foreground/70">· cached</span>}
    </span>
  );
}