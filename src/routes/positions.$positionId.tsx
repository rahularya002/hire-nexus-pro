import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, MapPin, Calendar, Users, Sparkles, FileText, X, Mail, Star, Eye,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, StatusBadge, StageBadge } from "@/components/ui-bits";
import { getPosition, getClient, PIPELINE_STAGES } from "@/lib/mock-data";

export const Route = createFileRoute("/positions/$positionId")({
  component: () => <AppShell><PositionDetail /></AppShell>,
});

function PositionDetail() {
  const { positionId } = Route.useParams();
  const position = getPosition(positionId);
  if (!position) throw notFound();
  const client = getClient(position.clientId)!;
  const [scoutOpen, setScoutOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Link to="/clients/$clientId" params={{ clientId: client.id }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {client.name}
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{position.title}</h1>
              <PriorityBadge priority={position.priority} />
              <StatusBadge status={position.status} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-3">
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {position.location}</span>
              <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" /> Posted {position.postedDays}d ago</span>
              <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> {position.openings} opening{position.openings>1?"s":""}</span>
              <span>{position.experience} · {position.salary}</span>
            </div>
            <p className="text-sm text-foreground/80 mt-4 max-w-3xl leading-relaxed">{position.description}</p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {position.skills.map(s => (
                <span key={s} className="text-xs px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground font-medium">{s}</span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setScoutOpen(true)}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-gradient-to-br from-primary to-purple text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition"
          >
            <Sparkles className="size-4" /> AI Talent Scout
          </button>
        </div>
      </div>

      {/* Pipeline stepper */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold tracking-tight">Pipeline</h3>
          <div className="text-xs text-muted-foreground">{position.candidates.length} candidates total</div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage, i) => {
            const count = position.candidates.filter(c => c.stage === stage).length;
            const isLast = i === PIPELINE_STAGES.length - 1;
            return (
              <div key={stage} className="flex items-center shrink-0">
                <div className="min-w-[160px] rounded-lg border border-border bg-gradient-to-br from-secondary/40 to-transparent p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Stage {i+1}</div>
                  <div className="text-sm font-medium mt-1">{stage}</div>
                  <div className="text-2xl font-semibold tabular-nums mt-2 text-primary">{count}</div>
                </div>
                {!isLast && <div className="w-4 h-px bg-border" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Candidates */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold tracking-tight">Candidates</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Sorted by AI match score</p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {[...position.candidates].sort((a,b) => b.matchScore - a.matchScore).map((c) => (
            <div key={c.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-secondary/40 transition">
              <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                <div className="size-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold">{c.initials}</div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.role} · {c.experience}</div>
                </div>
              </div>
              <div className="md:col-span-2 text-xs text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="size-3" /> {c.location}
              </div>
              <div className="md:col-span-2">
                <MatchScore score={c.matchScore} />
              </div>
              <div className="md:col-span-2"><StageBadge stage={c.stage} /></div>
              <div className="md:col-span-2 flex items-center gap-1 md:justify-end">
                <button className="size-8 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" title="View CV">
                  <Eye className="size-4" />
                </button>
                <button className="size-8 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" title="Email">
                  <Mail className="size-4" />
                </button>
                <button className="size-8 grid place-items-center rounded-md hover:bg-warning/15 text-warning" title="Shortlist">
                  <Star className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {scoutOpen && <AIScoutModal onClose={() => setScoutOpen(false)} title={position.title} />}
    </div>
  );
}

function MatchScore({ score }: { score: number }) {
  const tone = score >= 90 ? "text-success" : score >= 80 ? "text-info" : score >= 70 ? "text-warning" : "text-muted-foreground";
  const bar = score >= 90 ? "bg-success" : score >= 80 ? "bg-info" : score >= 70 ? "bg-warning" : "bg-muted-foreground";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${score}%` }} />
      </div>
      <div className={`text-xs font-semibold tabular-nums ${tone}`}>{score}%</div>
    </div>
  );
}

function AIScoutModal({ onClose, title }: { onClose: () => void; title: string }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const sample = [
    { name: "Vivaan Bhatt", role: "Senior Designer", company: "Swiggy", score: 96 },
    { name: "Nisha Reddy", role: "Product Designer", company: "PhonePe", score: 93 },
    { name: "Arnav Joshi", role: "Lead Designer", company: "CRED", score: 91 },
    { name: "Riya Saxena", role: "Sr. UX Designer", company: "Flipkart", score: 88 },
    { name: "Kabir Anand", role: "Designer II", company: "Groww", score: 85 },
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-gradient-to-br from-primary to-purple grid place-items-center text-primary-foreground">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="font-semibold">AI Talent Scout</div>
              <div className="text-xs text-muted-foreground">Sourcing for: {title}</div>
            </div>
          </div>
          <button onClick={onClose} className="size-9 grid place-items-center rounded-md hover:bg-secondary"><X className="size-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!done ? (
            <>
              <label className="text-sm font-medium">Add sourcing instructions</label>
              <textarea
                rows={3}
                defaultValue="Find senior product designers from top fintech and consumer tech companies in India. Strong design systems experience preferred."
                className="w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              <div className="flex flex-wrap gap-2">
                {["LinkedIn", "Naukri", "Internal DB", "Referrals", "GitHub"].map(s => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground">{s}</span>
                ))}
              </div>
              <button
                onClick={() => { setRunning(true); setTimeout(() => { setRunning(false); setDone(true); }, 1200); }}
                disabled={running}
                className="w-full h-11 rounded-lg bg-gradient-to-br from-primary to-purple text-primary-foreground font-medium inline-flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {running ? "Scouting talent..." : (<><Sparkles className="size-4" /> Run Scout</>)}
              </button>
            </>
          ) : (
            <>
              <div className="text-sm font-medium">Top 5 matches found</div>
              <div className="space-y-2">
                {sample.map(s => (
                  <div key={s.name} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="size-9 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold">
                      {s.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.role} · {s.company}</div>
                    </div>
                    <div className="text-sm font-semibold text-success tabular-nums">{s.score}%</div>
                    <button className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium">Add</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}