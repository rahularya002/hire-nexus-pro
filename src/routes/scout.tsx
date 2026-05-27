import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, Loader2, User, Linkedin, Database, Github, Globe, Briefcase, Users, Check, Paperclip, FileText, X, Layers, Building2, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { scoutChat } from "@/lib/scout.functions";
import { getPositionById } from "@/lib/positions.functions";
import { listScoutClients } from "@/lib/clients.functions";
import { parseJdFile } from "@/lib/parse-jd";
import { scoutCandidates, type ScoutCandidate } from "@/lib/scout-match.functions";
import { ScoutResults } from "@/components/scout-results";
import { cn } from "@/lib/utils";

const scoutSearchSchema = z.object({ positionId: z.string().uuid().optional() });

export const Route = createFileRoute("/scout")({
  validateSearch: (s) => scoutSearchSchema.parse(s),
  component: ScoutPage,
});

type Msg = { role: "user" | "assistant"; content: string };

type SourceId = "internal" | "linkedin" | "naukri" | "iimjobs" | "hirist" | "instahyre" | "github" | "angellist" | "cutshort" | "referrals";

const SOURCES: { id: SourceId; label: string; icon: typeof Linkedin; hint: string }[] = [
  { id: "internal",  label: "Internal database", icon: Database,  hint: "Your existing candidate pool" },
  { id: "linkedin",  label: "LinkedIn",          icon: Linkedin,  hint: "Recruiter & Sales Navigator" },
  { id: "naukri",    label: "Naukri",            icon: Briefcase, hint: "Naukri.com resdex" },
  { id: "iimjobs",   label: "iimjobs",           icon: Briefcase, hint: "Mid-senior roles" },
  { id: "hirist",    label: "Hirist",            icon: Briefcase, hint: "Tech hiring" },
  { id: "instahyre", label: "Instahyre",         icon: Briefcase, hint: "Curated tech talent" },
  { id: "cutshort",  label: "Cutshort",          icon: Briefcase, hint: "Startup talent" },
  { id: "github",    label: "GitHub",            icon: Github,    hint: "Engineers & contributors" },
  { id: "angellist", label: "Wellfound",         icon: Globe,     hint: "Startup ecosystem" },
  { id: "referrals", label: "Referrals",         icon: Users,     hint: "Internal employee referrals" },
];

function ScoutPage() {
  return (
    <AppShell>
      <Scout />
    </AppShell>
  );
}

function Scout() {
  const ask = useServerFn(scoutChat);
  const fetchPosition = useServerFn(getPositionById);
  const fetchClients = useServerFn(listScoutClients);
  const navigate = useNavigate();
  const { positionId } = Route.useSearch();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SourceId[]>(() => SOURCES.map((s) => s.id));
  const [cv, setCv] = useState<{ name: string; text: string } | null>(null);
  const [parsingCv, setParsingCv] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ScoutCandidate[] | null>(null);
  const runScout = useServerFn(scoutCandidates);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clientMenuRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef<string | null>(null);

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["scout-clients"],
    queryFn: () => fetchClients(),
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
        const brief = [
          `Role: ${p.title}`,
          p.location ? `Location: ${p.location}` : null,
          p.experience ? `Experience: ${p.experience}` : null,
          p.salary ? `Compensation: ${p.salary}` : null,
          `Openings: ${p.openings}`,
          p.skills.length ? `Must-have skills: ${p.skills.join(", ")}` : null,
          p.description ? `\nJob description:\n${p.description}` : null,
        ].filter(Boolean).join("\n");
        setCv({ name: `${p.title} — JD`, text: brief });
        setInput(`Source 5 strong candidates for this ${p.title} role.`);
      } catch (e) {
        console.error(e);
      } finally {
        navigate({ to: "/scout", search: {}, replace: true });
      }
    })();
  }, [positionId, fetchPosition, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !cv) || loading) return;
    setError(null);
    const userContent = cv
      ? `${trimmed || "Please review the attached CV."}\n\n--- Attached CV: ${cv.name} ---\n${cv.text.slice(0, 18000)}`
      : trimmed;
    const next: Msg[] = [...messages, { role: "user", content: userContent }];
    setMessages(next);
    setInput("");
    setCv(null);
    setLoading(true);
    try {
      const sourceLabels = SOURCES.filter((s) => selected.includes(s.id)).map((s) =>
        s.id === "internal" ? "Internal database" : s.label
      );
      const res = await ask({
        data: {
          messages: next,
          sources: sourceLabels,
          clientName: selectedClient?.name ?? null,
        },
      });
      if (res.error) {
        setError(res.error);
      } else {
        setMessages([...next, { role: "assistant", content: res.content || "" }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: SourceId) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const allSelected = selected.length === SOURCES.length;
  function toggleAll() {
    setSelected(allSelected ? [] : SOURCES.map((s) => s.id));
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
    } catch (e) {
      console.error(e);
      setError("Failed to read CV. Try PDF, DOCX, or TXT.");
    } finally {
      setParsingCv(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleGenerateMatches() {
    // Use the attached JD if present, otherwise the last user message as the brief.
    const briefText = cv?.text ?? [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const titleGuess = (cv?.name?.replace(/\s*[—-].*$/, "").trim()) || briefText.split("\n")[0]?.slice(0, 120) || "";
    if (!titleGuess.trim()) {
      setMatchError("Attach a JD or send a role brief first so Scout knows what to match.");
      return;
    }
    setMatching(true);
    setMatchError(null);
    setMatches(null);
    try {
      const res = await runScout({
        data: {
          jobTitle: titleGuess,
          jd: briefText,
          fileName: cv?.name ?? null,
        },
      });
      if (res.error) setMatchError(res.error);
      setMatches(res.candidates);
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : "Talent Scout failed.");
    } finally {
      setMatching(false);
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
          {SOURCES.map((s) => {
            const active = selected.includes(s.id);
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                title={s.hint}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}
              >
                {active ? <Check className="size-3 text-primary" /> : <Icon className="size-3" />}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full min-h-[200px] grid place-items-center text-center">
            <div className="space-y-2">
              <div className="mx-auto size-10 rounded-full bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground">
                <Sparkles className="size-5" />
              </div>
              <p className="text-sm text-muted-foreground">
                Ask AI Talent Scout anything about sourcing, screening, or outreach.
              </p>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="size-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground">
                <Sparkles className="size-4" />
              </div>
            )}
            <div
              className={cn(
                "rounded-2xl px-4 py-2.5 text-sm max-w-[80%]",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              )}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&_*]:my-1 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_ul]:pl-5 [&_ol]:pl-5">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
            {m.role === "user" && (
              <div className="size-8 shrink-0 rounded-full bg-secondary text-foreground grid place-items-center">
                <User className="size-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="size-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <div className="rounded-2xl px-4 py-2.5 bg-card border border-border text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Scouting...
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm px-3 py-2">
            {error}
          </div>
        )}

        {(matching || matchError || matches) && (
          <ScoutResults loading={matching} error={matchError} candidates={matches} />
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
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
          disabled={parsingCv || loading}
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
              send(input);
            }
          }}
          rows={1}
          placeholder={cv ? "Add a question about the CV (optional)..." : "Describe the role, paste a JD, or ask anything..."}
          className="flex-1 resize-none rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 focus:bg-background min-h-[44px] max-h-40"
        />
        <button
          type="button"
          onClick={handleGenerateMatches}
          disabled={matching || loading}
          title="Generate candidate matches from the attached JD or latest brief"
          className="h-11 px-3 rounded-lg border border-primary/40 bg-gradient-to-br from-primary/10 via-purple/10 to-info/10 text-primary text-sm font-medium inline-flex items-center gap-1.5 hover:bg-primary/15 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {matching ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Match
        </button>
        <button
          type="submit"
          disabled={loading || parsingCv || (!input.trim() && !cv)}
          className="h-11 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm inline-flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="size-4" /> Send
        </button>
        </div>
      </form>
    </div>
  );
}