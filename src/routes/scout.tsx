import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, Loader2, User, Linkedin, Database, Github, Globe, Briefcase, Users, Check, Paperclip, FileText, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { scoutChat } from "@/lib/scout.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scout")({
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

const STARTERS = [
  "Source 5 senior React engineers in Bengaluru with fintech experience.",
  "Draft an outreach message for a Staff Data Scientist role.",
  "Evaluate this candidate: 8y backend, Go + Kafka, ex-Razorpay.",
  "What interview questions for a Head of Design at a B2B SaaS?",
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
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SourceId[]>(["internal", "linkedin", "naukri"]);
  const [cv, setCv] = useState<{ name: string; text: string } | null>(null);
  const [parsingCv, setParsingCv] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const res = await ask({ data: { messages: next, sources: sourceLabels } });
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

  async function handleFile(file: File) {
    setError(null);
    setParsingCv(true);
    try {
      const name = file.name;
      const lower = name.toLowerCase();
      let text = "";
      if (lower.endsWith(".pdf")) {
        const pdfjs = await import("pdfjs-dist");
        // Use a worker shipped with the package via Vite ?url import
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const buf = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        const parts: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          parts.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
        }
        text = parts.join("\n\n");
      } else if (lower.endsWith(".docx")) {
        const mammoth = await import("mammoth/mammoth.browser");
        const buf = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: buf });
        text = res.value;
      } else {
        // txt, md, rtf, doc, csv — best-effort plain read
        text = await file.text();
      }
      text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      if (!text) {
        setError(`Couldn't extract text from ${name}. Try a PDF, DOCX, or TXT export.`);
        return;
      }
      setCv({ name, text });
    } catch (e) {
      console.error(e);
      setError("Failed to read CV. Try PDF, DOCX, or TXT.");
    } finally {
      setParsingCv(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      <div className="flex items-center gap-3 pb-6 border-b border-border">
        <div className="size-10 rounded-lg bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground shadow-sm">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">AI Talent Scout</h1>
          <p className="text-xs text-muted-foreground">Source, evaluate and shortlist candidates faster.</p>
        </div>
      </div>

      <div className="pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Sourcing channels</div>
          <div className="text-[11px] text-muted-foreground">{selected.length} selected</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
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
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Try one of these to get started:</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-secondary/40 transition p-3"
                >
                  {s}
                </button>
              ))}
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