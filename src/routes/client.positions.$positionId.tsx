import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft, MapPin, Check, X, Calendar, Eye, FileText, CheckCircle2, Clock, MessageSquare, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientShell, ClientStatusBadge } from "@/components/client-shell";
import { getClientPosition, messageThreads, type SharedCandidate, type ClientMessage } from "@/lib/client-data";

export const Route = createFileRoute("/client/positions/$positionId")({
  component: () => <ClientShell><Detail /></ClientShell>,
});

function Detail() {
  const { positionId } = Route.useParams();
  const initial = getClientPosition(positionId);
  if (!initial) throw notFound();

  const [candidates, setCandidates] = useState<SharedCandidate[]>(initial.candidates);
  const [tab, setTab] = useState<"candidates" | "interviews" | "documents" | "messages">("candidates");
  const [messages, setMessages] = useState<ClientMessage[]>(messageThreads[positionId] ?? []);

  const update = (id: string, status: SharedCandidate["status"]) =>
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status } : c));

  return (
    <div className="space-y-6">
      <Link to="/client/positions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All positions
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{initial.title}</h1>
              <ClientStatusBadge status={initial.status} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-3">
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{initial.location}</span>
              <span>{initial.experience} · {initial.salary}</span>
              <span>{initial.openings} opening{initial.openings>1?"s":""}</span>
              <span>Posted {initial.postedDays}d ago</span>
            </div>
            <p className="text-sm text-foreground/80 mt-4 max-w-3xl leading-relaxed">{initial.description}</p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {initial.skills.map(s => <span key={s} className="text-xs px-2.5 py-1 rounded-md bg-secondary font-medium">{s}</span>)}
            </div>
          </div>
          <button
            onClick={() => setTab("messages")}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary relative">
            <MessageSquare className="size-4" /> Message recruiter
            {messages.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                {messages.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-secondary/60 w-fit">
        {[
          { id: "candidates" as const, label: `Candidates (${candidates.length})` },
          { id: "interviews" as const, label: "Interviews" },
          { id: "documents" as const, label: "Documents" },
          { id: "messages" as const, label: `Messages (${messages.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("px-4 py-2 rounded-md text-sm font-medium transition",
              tab === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "candidates" && <CandidateList candidates={candidates} onUpdate={update} />}
      {tab === "interviews" && <Interviews slots={initial.interviewSlots ?? []} />}
      {tab === "documents" && <Documents docs={initial.documents ?? []} />}
      {tab === "messages" && <Messages messages={messages} onSend={(body) => setMessages(prev => [...prev, { id: `m-${Date.now()}`, from: "client", authorName: "You", initials: "VS", body, timeAgo: "Just now" }])} />}
    </div>
  );
}

function CandidateList({ candidates, onUpdate }: { candidates: SharedCandidate[]; onUpdate: (id: string, s: SharedCandidate["status"]) => void }) {
  return (
    <div className="grid gap-3">
      {candidates.map(c => (
        <div key={c.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <div className="size-12 shrink-0 rounded-xl bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-sm font-semibold">
              {c.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{c.name}</h3>
                    <CandidateStatusBadge status={c.status} />
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">{c.role} · {c.experience} · {c.location}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums text-success">{c.matchScore}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">match</div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-foreground/80 mt-3 leading-relaxed">{c.summary}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <Mini label="Current" value={c.currentCompany} />
                <Mini label="Expected CTC" value={c.expectedCtc} />
                <Mini label="Notice period" value={c.noticePeriod} />
                <Mini label="Location" value={c.location} />
              </div>

              <div className="flex flex-wrap gap-1.5 mt-4">
                {c.skills.map(s => <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-secondary">{s}</span>)}
              </div>

              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border flex-wrap">
                <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary">
                  <Eye className="size-4" /> View CV
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => onUpdate(c.id, "rejected")}
                  disabled={c.status === "rejected"}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 disabled:opacity-50">
                  <X className="size-4" /> Reject
                </button>
                <button
                  onClick={() => onUpdate(c.id, "shortlisted")}
                  disabled={c.status === "shortlisted" || c.status === "interview"}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-success text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  <Check className="size-4" /> Shortlist
                </button>
                <button
                  onClick={() => onUpdate(c.id, "interview")}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                  <Calendar className="size-4" /> Schedule interview
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CandidateStatusBadge({ status }: { status: SharedCandidate["status"] }) {
  const map = {
    pending: { c: "bg-warning/15 text-warning", l: "Pending review" },
    shortlisted: { c: "bg-purple/15 text-purple", l: "Shortlisted" },
    rejected: { c: "bg-destructive/10 text-destructive", l: "Rejected" },
    interview: { c: "bg-info/15 text-info", l: "In interviews" },
  };
  const v = map[status];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium", v.c)}>{v.l}</span>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}

function Interviews({ slots }: { slots: { id: string; date: string; time: string; panel: string; mode: string }[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold flex items-center gap-2"><Calendar className="size-4 text-primary" /> Proposed interview slots</h3>
        <p className="text-xs text-muted-foreground mt-1">Confirm a slot or propose new times to the recruiter</p>
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          {slots.length === 0 ? (
            <div className="col-span-full text-sm text-muted-foreground py-8 text-center">No slots proposed yet — shortlist a candidate to begin.</div>
          ) : slots.map(s => (
            <div key={s.id} className="rounded-lg border border-border p-4 hover:border-primary/30 hover:shadow-sm transition">
              <div className="text-xs text-muted-foreground">{s.date}</div>
              <div className="text-lg font-semibold tabular-nums text-primary mt-0.5">{s.time}</div>
              <div className="text-xs mt-3"><span className="text-muted-foreground">Panel:</span> {s.panel}</div>
              <div className="text-xs"><span className="text-muted-foreground">Mode:</span> {s.mode}</div>
              <button className="mt-4 w-full h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium">Confirm slot</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Documents({ docs }: { docs: { name: string; required: boolean; received: boolean }[] }) {
  if (!docs.length) {
    return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Documents checklist appears once a candidate is offered.</div>;
  }
  const received = docs.filter(d => d.received).length;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><FileText className="size-4 text-primary" /> Onboarding documents</h3>
          <p className="text-xs text-muted-foreground mt-0.5">For: Arjun Malhotra (Selected)</p>
        </div>
        <div className="text-sm font-medium tabular-nums">{received}/{docs.length} received</div>
      </div>
      <div className="divide-y divide-border">
        {docs.map(d => (
          <div key={d.name} className="flex items-center gap-4 px-5 py-3.5">
            <div className={cn("size-8 rounded-full grid place-items-center", d.received ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
              {d.received ? <CheckCircle2 className="size-4" /> : <Clock className="size-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{d.name}</div>
              <div className="text-xs text-muted-foreground">{d.required ? "Required" : "Optional"}</div>
            </div>
            <span className={cn("text-xs font-medium", d.received ? "text-success" : "text-warning")}>
              {d.received ? "Received" : "Awaiting"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Messages({ messages, onSend }: { messages: ClientMessage[]; onSend: (body: string) => void }) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft("");
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
      <div className="p-5 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="size-4 text-primary" /> Conversation with recruiter</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Per-position thread — recruiter typically replies within 2 hours</p>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-secondary/20">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">No messages yet — say hello to your recruiter.</div>
        ) : messages.map(m => {
          const mine = m.from === "client";
          return (
            <div key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
              <div className={cn("size-9 shrink-0 rounded-full grid place-items-center text-xs font-semibold",
                mine ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-purple to-primary text-primary-foreground")}>
                {m.initials}
              </div>
              <div className={cn("max-w-[75%] min-w-0", mine && "items-end flex flex-col")}>
                <div className={cn("flex items-center gap-2 text-xs text-muted-foreground mb-1", mine && "flex-row-reverse")}>
                  <span className="font-medium text-foreground">{m.authorName}</span>
                  <span>·</span>
                  <span>{m.timeAgo}</span>
                </div>
                <div className={cn("rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  mine ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm")}>
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={2}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            <Send className="size-4" /> Send
          </button>
        </div>
      </div>
    </div>
  );
}

function Messages({ messages, onSend }: { messages: ClientMessage[]; onSend: (body: string) => void }) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft("");
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
      <div className="p-5 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="size-4 text-primary" /> Conversation with recruiter</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Per-position thread — recruiter typically replies within 2 hours</p>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-secondary/20">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">No messages yet — say hello to your recruiter.</div>
        ) : messages.map(m => {
          const mine = m.from === "client";
          return (
            <div key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
              <div className={cn("size-9 shrink-0 rounded-full grid place-items-center text-xs font-semibold",
                mine ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-purple to-primary text-primary-foreground")}>
                {m.initials}
              </div>
              <div className={cn("max-w-[75%] min-w-0", mine && "items-end flex flex-col")}>
                <div className={cn("flex items-center gap-2 text-xs text-muted-foreground mb-1", mine && "flex-row-reverse")}>
                  <span className="font-medium text-foreground">{m.authorName}</span>
                  <span>·</span>
                  <span>{m.timeAgo}</span>
                </div>
                <div className={cn("rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  mine ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm")}>
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={2}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            <Send className="size-4" /> Send
          </button>
        </div>
      </div>
    </div>
  );
}
