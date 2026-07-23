import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Sparkles, Loader2, Check, Paperclip, FileText, X, Layers, Building2, ChevronDown, Search, Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getPositionById } from "@/lib/positions.functions";
import { listScoutClients } from "@/lib/clients.functions";
import { parseJdFile, extractFieldsFromJd } from "@/lib/parse-jd";
import {
  searchSourcedCandidates,
  runApifyScout,
  rankSourcedMatches,
  rejectSourcedMatch,
  shortlistSourcedMatch,
  addDatabaseCandidateToPosition,
  type SourcedMatchView,
} from "@/lib/apify.functions";
import { listSourceSettings } from "@/lib/admin-settings.functions";
import { SCOUT_SOURCES, type ScoutSourceId } from "@/lib/scout-sources";
import { ScoutResults } from "@/components/scout-results";
import { cn } from "@/lib/utils";

const scoutSearchSchema = z.object({ positionId: z.string().uuid().optional() });

export const Route = createFileRoute("/scout")({
  validateSearch: (s) => scoutSearchSchema.parse(s),
  component: ScoutPage,
});

type SourceId = ScoutSourceId;

function ScoutPage() {
  return (
    <AppShell>
      <Scout />
    </AppShell>
  );
}

function Scout() {
  const fetchPosition = useServerFn(getPositionById);
  const fetchClients = useServerFn(listScoutClients);
  const fetchSourceSettings = useServerFn(listSourceSettings);
  const navigate = useNavigate();
  const { positionId } = Route.useSearch();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SourceId[]>(() =>
    SCOUT_SOURCES.filter((s) => s.hasActor).map((s) => s.id),
  );
  const [cv, setCv] = useState<{ name: string; text: string } | null>(null);
  const [parsingCv, setParsingCv] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matches, setMatches] = useState<SourcedMatchView[] | null>(null);
  const [matchLabel, setMatchLabel] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activePositionId, setActivePositionId] = useState<string | null>(null);
  const [jdContext, setJdContext] = useState<string>("");
  const [skillsContext, setSkillsContext] = useState<string[]>([]);
  const [titleContext, setTitleContext] = useState<string>("");
  const [locationContext, setLocationContext] = useState<string>("");
  const searchInternal = useServerFn(searchSourcedCandidates);
  const runApify = useServerFn(runApifyScout);
  const rankMatches = useServerFn(rankSourcedMatches);
  const rejectMatch = useServerFn(rejectSourcedMatch);
  const shortlistMatch = useServerFn(shortlistSourcedMatch);
  const addDatabaseCandidate = useServerFn(addDatabaseCandidateToPosition);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clientMenuRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef<string | null>(null);

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["scout-clients"],
    queryFn: () => fetchClients(),
  });
  const { data: sourceSettings = [] } = useQuery({
    queryKey: ["scout-source-settings"],
    queryFn: () => fetchSourceSettings(),
  });

  const sources = SCOUT_SOURCES.map((s) => {
    const override = sourceSettings.find((x) => x.source_id === s.id);
    return {
      ...s,
      enabled: s.hasActor && (override?.enabled ?? true),
    };
  });

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  useEffect(() => {
    if (!clientMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!clientMenuRef.current?.contains(e.target as Node)) setClientMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [clientMenuOpen]);

  useEffect(() => {
    if (!positionId || seededRef.current === positionId) return;
    seededRef.current = positionId;
    (async () => {
      try {
        const p = await fetchPosition({ data: { id: positionId } });
        if (!p) return;
        if (p.client_id) setClientId(p.client_id);
        setActivePositionId(p.id);
        setTitleContext(p.title);
        setSkillsContext(p.skills ?? []);
        setLocationContext(p.location ?? "");
        const brief = [
          `Role: ${p.title}`,
          p.location ? `Location: ${p.location}` : null,
          p.experience ? `Experience: ${p.experience}` : null,
          p.salary ? `Compensation: ${p.salary}` : null,
          `Openings: ${p.openings}`,
          p.skills.length ? `Must-have skills: ${p.skills.join(", ")}` : null,
          p.description ? `\nJob description:\n${p.description}` : null,
        ].filter(Boolean).join("\n");
        setJdContext(brief);
        setCv({ name: `${p.title} — JD`, text: brief });
        setInput(`Source 5 strong candidates for this ${p.title} role.`);
      } catch (e) {
        console.error(e);
      } finally {
        navigate({ to: "/scout", search: {}, replace: true });
      }
    })();
  }, [positionId, fetchPosition, navigate]);

  function toggle(id: SourceId) {
    const def = sources.find((s) => s.id === id);
    if (def && !def.enabled) return;
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const enabledIds = sources.filter((s) => s.enabled).map((s) => s.id);
  const allSelected = selected.length === enabledIds.length && enabledIds.every((id) => selected.includes(id));
  function toggleAll() {
    setSelected(allSelected ? [] : enabledIds);
  }

  async function handleFile(file: File) {
    setError(null);
    setParsingCv(true);
    try {
      const text = await parseJdFile(file);
      if (!text) {
        setError(`Couldn't extract text from ${file.name}. Try a PDF, DOCX, or TXT export.`);
        return;
      }
      setCv({ name: file.name, text });
      // Auto-populate title / skills / location so DB search actually filters against the JD.
      try {
        const fields = extractFieldsFromJd(text);
        if (fields.jobTitle && !titleContext) setTitleContext(fields.jobTitle);
        if (fields.location && !locationContext) setLocationContext(fields.location);
        if (fields.skills && skillsContext.length === 0) {
          const parts = fields.skills
            .split(/[,;|/]/)
            .map((s) => s.trim())
            .filter((s) => s.length >= 2 && s.length <= 40);
          if (parts.length) setSkillsContext(parts);
        }
      } catch (e) {
        console.warn("JD field extract failed:", e);
      }
    } catch (e) {
      console.error(e);
      setError("Failed to read CV. Try PDF, DOCX, or TXT.");
    } finally {
      setParsingCv(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function deriveContext() {
    const briefText = [input.trim(), cv?.text ?? ""].filter(Boolean).join("\n\n");
    const titleGuess =
      titleContext ||
      cv?.name?.replace(/\s*[—-].*$/, "").trim() ||
      input.trim().split("\n")[0]?.slice(0, 120) ||
      briefText.split("\n")[0]?.slice(0, 120) ||
      "";
    return { briefText, titleGuess };
  }

  async function handleMatch() {
    const { briefText, titleGuess } = deriveContext();
    if (!titleGuess.trim()) {
      setMatchError("Attach a JD or describe the role first.");
      return;
    }
    const internalSelected = selected.includes("internal");
    const apifySources = selected.filter(
      (s): s is "linkedin" | "github" | "naukri" =>
        s === "linkedin" || s === "github" || s === "naukri",
    );
    if (!internalSelected && apifySources.length === 0) {
      setMatchError("Pick at least one sourcing channel (Internal database, LinkedIn, GitHub, or Naukri).");
      return;
    }
    setMatching(true);
    setMatchError(null);
    setMatches(null);
    setJdContext(briefText);
    try {
      // 1. Internal DB search (only if user picked it)
      if (internalSelected) {
        setMatchLabel("Searching your database...");
        const res = await searchInternal({
          data: {
            positionId: activePositionId ?? undefined,
            jobTitle: titleGuess,
            skills: skillsContext,
            location: locationContext || undefined,
            limit: 25,
          },
        });
        setMatches(res.matches);
        setMatchLabel(
          res.matches.length
            ? `${res.matches.length} from your database`
            : apifySources.length
              ? "No database matches — sourcing fresh..."
              : "No matches in your database yet — enable LinkedIn / GitHub / Naukri to source fresh.",
        );
      }

      // 2. External sourcing (only if user picked at least one external channel)
      if (apifySources.length > 0) {
        setMatchLabel(`Sourcing from ${apifySources.join(" + ")}...`);
        const run = await runApify({
          data: {
            positionId: activePositionId ?? undefined,
            sources: apifySources.slice(0, 2),
            jobTitle: titleGuess,
            skills: skillsContext,
            location: locationContext || undefined,
            jdText: briefText.slice(0, 18_000),
            maxResults: 15,
          },
        });
        if (run?.errors?.length && !run?.resultCount) {
          setMatchError(run.errors.join(" | "));
        }
        if (activePositionId && briefText.length > 20 && run?.sourcedIds?.length) {
          setMatchLabel("Ranking candidates against the JD...");
          try {
            await rankMatches({
              data: {
                positionId: activePositionId,
                jdText: briefText.slice(0, 18_000),
                sourcedCandidateIds: run.sourcedIds.slice(0, 50),
              },
            });
          } catch (e) {
            console.warn("AI ranking failed:", e);
          }
        }
        // Refresh combined view (internal + newly sourced) if we can search
        const refreshed = await searchInternal({
          data: {
            positionId: activePositionId ?? undefined,
            jobTitle: titleGuess,
            skills: skillsContext,
            location: locationContext || undefined,
            limit: 25,
          },
        });
        // If user didn't pick internal, filter out purely-database rows
        const filtered = internalSelected
          ? refreshed.matches
          : refreshed.matches.filter((m) => m.source !== "database");
        setMatches(filtered);
        setMatchLabel(
          `${filtered.length} candidates · ${run?.resultCount ?? 0} newly sourced from ${apifySources.join(" + ")}`,
        );
      }
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setMatching(false);
    }
  }

  async function handleSourceFresh() {
    const { briefText, titleGuess } = deriveContext();
    if (!titleGuess.trim()) {
      setMatchError("Attach a JD or describe the role first.");
      return;
    }
    const apifySources = selected.filter((s): s is "linkedin" | "github" =>
      s === "linkedin" || s === "github",
    );
    if (!apifySources.length) {
      setMatchError("Select LinkedIn or GitHub to source fresh candidates.");
      return;
    }
    setMatching(true);
    setMatchError(null);
    setMatchLabel(`Sourcing from ${apifySources.join(" + ")}...`);
    try {
      const run = await runApify({
        data: {
          positionId: activePositionId ?? undefined,
          sources: apifySources,
          jobTitle: titleGuess,
          skills: skillsContext,
          location: locationContext || undefined,
          jdText: briefText.slice(0, 18_000),
          maxResults: 15,
        },
      });
      if (run?.errors?.length && !run?.resultCount) {
        setMatchError(run.errors.join(" | "));
      }

      // AI rank if we have a position + JD + results
      if (activePositionId && briefText.length > 20 && run?.sourcedIds?.length) {
        setMatchLabel("Ranking candidates against the JD...");
        try {
          await rankMatches({
            data: {
              positionId: activePositionId,
              jdText: briefText.slice(0, 18_000),
              sourcedCandidateIds: run.sourcedIds.slice(0, 50),
            },
          });
        } catch (e) {
          console.warn("AI ranking failed:", e);
        }
      }

      // Re-fetch (now includes scores)
      const refreshed = await searchInternal({
        data: {
          positionId: activePositionId ?? undefined,
          jobTitle: titleGuess,
          skills: skillsContext,
          location: locationContext || undefined,
          limit: 25,
        },
      });
      setMatches(refreshed.matches);
      setMatchLabel(
        `${refreshed.matches.length} candidates · ${run?.resultCount ?? 0} newly sourced`,
      );
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : "Apify sourcing failed.");
    } finally {
      setMatching(false);
    }
  }

  async function handleShortlist(m: SourcedMatchView) {
    if (!activePositionId) {
      setMatchError("Open Talent Scout from a specific position to shortlist.");
      return;
    }
    setBusyId(m.sourcedCandidateId);
    try {
      const result = m.source === "database"
        ? await addDatabaseCandidate({
            data: {
              positionId: activePositionId,
              candidateId: m.sourcedCandidateId,
            },
          })
        : m.matchId
          ? await shortlistMatch({
              data: {
                matchId: m.matchId,
                positionId: activePositionId,
                sourcedCandidateId: m.sourcedCandidateId,
              },
            })
          : null;
      if (!result) {
        setMatchError("Open Talent Scout from a specific position to shortlist.");
        return;
      }
      setMatches((prev) =>
        prev
          ? prev.map((x) =>
              x.sourcedCandidateId === m.sourcedCandidateId
                ? { ...x, positionStatus: "in_pipeline", applicationStage: "sourcing" }
                : x,
            )
          : prev,
      );
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : "Shortlist failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(m: SourcedMatchView) {
    if (!m.matchId) {
      // Just hide locally if there's no positionId
      setMatches((prev) =>
        prev ? prev.filter((x) => x.sourcedCandidateId !== m.sourcedCandidateId) : prev,
      );
      return;
    }
    setBusyId(m.sourcedCandidateId);
    try {
      await rejectMatch({ data: { matchId: m.matchId } });
      setMatches((prev) =>
        prev ? prev.filter((x) => x.sourcedCandidateId !== m.sourcedCandidateId) : prev,
      );
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : "Reject failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      <div className="flex items-center gap-3 pb-6 border-b border-border">
        <div className="size-10 rounded-lg bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground shadow-sm">
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">AI Talent Scout</h1>
          <p className="text-xs text-muted-foreground">Source, evaluate and shortlist candidates faster.</p>
        </div>
        <div className="relative" ref={clientMenuRef}>
          <button
            type="button"
            onClick={() => setClientMenuOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-card hover:bg-secondary/60 hover:border-primary/40 px-3 h-10 text-sm transition min-w-[180px]"
          >
            {selectedClient?.color ? (
              <span className="size-2.5 rounded-full" style={{ backgroundColor: selectedClient.color }} />
            ) : (
              <Building2 className="size-4 text-muted-foreground" />
            )}
            <span className={cn("flex-1 text-left truncate", !selectedClient && "text-muted-foreground")}>
              {selectedClient ? selectedClient.name : clientsLoading ? "Loading clients..." : "All clients"}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
          {clientMenuOpen && (
            <div className="absolute right-0 mt-1 z-20 w-72 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg p-1">
              <button
                type="button"
                onClick={() => { setClientId(null); setClientMenuOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-secondary/60",
                  !clientId && "bg-secondary/60"
                )}
              >
                <Building2 className="size-4 text-muted-foreground" />
                <span className="flex-1 text-left">All clients</span>
                {!clientId && <Check className="size-4 text-primary" />}
              </button>
              {clients.length === 0 && !clientsLoading && (
                <div className="px-2.5 py-3 text-xs text-muted-foreground">
                  No clients assigned to you yet.
                </div>
              )}
              {clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setClientId(c.id); setClientMenuOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-secondary/60",
                    clientId === c.id && "bg-secondary/60"
                  )}
                >
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: c.color ?? "hsl(var(--muted-foreground))" }}
                  />
                  <span className="flex-1 text-left truncate">{c.name}</span>
                  {clientId === c.id && <Check className="size-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Sourcing channels</div>
          <div className="text-[11px] text-muted-foreground">{selected.length} selected</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={toggleAll}
            title="Toggle every sourcing channel"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
              allSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
            )}
          >
            {allSelected ? <Check className="size-3" /> : <Layers className="size-3" />}
            All channels
          </button>
          {sources.map((s) => {
            const active = selected.includes(s.id);
            const Icon = s.hasActor ? s.icon : Lock;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                title={s.hint}
                disabled={!s.enabled}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                  !s.enabled && "opacity-40 cursor-not-allowed",
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}
              >
                {active ? <Check className="size-3 text-primary" /> : <Icon className="size-3" />}
                {s.label}
                {!s.hasActor && <span className="text-[9px] uppercase">soon</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {!matching && !matchError && !matches && (
          <div className="h-full min-h-[200px] grid place-items-center text-center">
            <div className="space-y-2 max-w-md">
              <div className="mx-auto size-10 rounded-full bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground">
                <Sparkles className="size-5" />
              </div>
              <p className="text-sm text-muted-foreground">
                Attach a JD or describe the role below, then hit <span className="font-medium text-foreground">Match</span> to source candidates.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm px-3 py-2">
            {error}
          </div>
        )}

        {(matching || matchError || matches) && (
          <>
            <ScoutResults
              loading={matching}
              error={matchError}
              candidates={matches}
              label={matchLabel}
              onShortlist={handleShortlist}
              onReject={handleReject}
              busyId={busyId}
            />
            {!matching && matches && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleSourceFresh}
                  disabled={matching}
                  className="h-9 px-4 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-medium inline-flex items-center gap-2"
                >
                  <Sparkles className="size-3.5" />
                  Source more from LinkedIn / GitHub
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleMatch();
        }}
        className="pt-3 border-t border-border space-y-2"
      >
        {cv && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs">
            <FileText className="size-3.5 text-primary" />
            <span className="font-medium truncate max-w-[220px]">{cv.name}</span>
            <span className="text-muted-foreground">· {Math.round(cv.text.length / 1000)}k chars</span>
            <button
              type="button"
              onClick={() => setCv(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remove CV"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md,.rtf,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={parsingCv || matching}
          title="Upload CV (PDF, DOCX, TXT)"
          className="h-11 w-11 shrink-0 rounded-lg border border-input bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 inline-flex items-center justify-center disabled:opacity-50"
        >
          {parsingCv ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleMatch();
            }
          }}
          rows={1}
          placeholder={cv ? "Add extra context for the match (optional)..." : "Describe the role or paste a JD..."}
          className="flex-1 resize-none rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 focus:bg-background min-h-[44px] max-h-40"
        />
        <button
          type="submit"
          disabled={matching || parsingCv || (!input.trim() && !cv)}
          className="h-11 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm inline-flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {matching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Match
        </button>
        </div>
      </form>
    </div>
  );
}