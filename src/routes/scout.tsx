import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, Loader2, User, Linkedin, Database, Github, Globe, Briefcase, Users, Check } from "lucide-react";
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
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
        className="pt-3 border-t border-border flex items-end gap-2"
      >
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
          placeholder="Describe the role, paste a JD, or ask anything..."
          className="flex-1 resize-none rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 focus:bg-background min-h-[44px] max-h-40"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="h-11 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm inline-flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="size-4" /> Send
        </button>
      </form>
    </div>
  );
}