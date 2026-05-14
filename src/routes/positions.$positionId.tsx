import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, MapPin, Calendar, Users, Sparkles, FileText, X, Check, Send, Undo2, Building2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, StatusBadge, StageBadge } from "@/components/ui-bits";
import { getPosition, getClient, PIPELINE_STAGES } from "@/lib/mock-data";
import { detailFor } from "@/lib/ops/store";

export const Route = createFileRoute("/positions/$positionId")({
  component: () => <AppShell><PositionDetail /></AppShell>,
});

function PositionDetail() {
  const { positionId } = Route.useParams();
  const position = getPosition(positionId);
  if (!position) throw notFound();
  const client = getClient(position.clientId)!;
  const [scoutOpen, setScoutOpen] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, "selected" | "rejected" | "shared" | "returned">>({});
  const [resumeFor, setResumeFor] = useState<string | null>(null);
  const setDecision = (id: string, v: "selected" | "rejected" | "shared" | "returned") =>
    setDecisions((d) => ({ ...d, [id]: d[id] === v ? undefined as any : v }));

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

      {/* Candidates table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold tracking-tight">Candidates</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Sorted by AI match score · {position.candidates.length} total</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {Object.values(decisions).filter(v => v === "selected").length} selected ·{" "}
            {Object.values(decisions).filter(v => v === "shared").length} shared ·{" "}
            {Object.values(decisions).filter(v => v === "rejected").length} rejected
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Candidate</th>
                <th className="px-4 py-3 font-medium">Experience</th>
                <th className="px-4 py-3 font-medium">Salary</th>
                <th className="px-4 py-3 font-medium">Previous org</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Notice</th>
                <th className="px-4 py-3 font-medium w-[140px]">AI match</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Resume</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...position.candidates].sort((a,b) => b.matchScore - a.matchScore).map((c) => {
                const d = detailFor(c);
                const decision = decisions[c.id];
                const rowTone =
                  decision === "selected" ? "bg-success/5"
                  : decision === "rejected" ? "bg-destructive/5 opacity-70"
                  : decision === "shared" ? "bg-info/5"
                  : decision === "returned" ? "bg-secondary/40 opacity-70"
                  : "";
                return (
                  <tr key={c.id} className={`hover:bg-secondary/40 transition ${rowTone}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 shrink-0 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold">{c.initials}</div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.experience}</td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">{d.salary}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5 text-muted-foreground" />{d.prevOrg}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{c.location}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{d.noticePeriod}</td>
                    <td className="px-4 py-3"><MatchScore score={c.matchScore} /></td>
                    <td className="px-4 py-3"><StageBadge stage={c.stage} /></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setResumeFor(c.id)}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-secondary"
                      >
                        <FileText className="size-3.5" /> Preview
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setDecision(c.id, "selected")}
                          title="Select"
                          className={`size-8 grid place-items-center rounded-md transition ${decision === "selected" ? "bg-success/20 text-success" : "hover:bg-success/10 text-muted-foreground hover:text-success"}`}
                        ><Check className="size-4" /></button>
                        <button
                          onClick={() => setDecision(c.id, "rejected")}
                          title="Reject"
                          className={`size-8 grid place-items-center rounded-md transition ${decision === "rejected" ? "bg-destructive/20 text-destructive" : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"}`}
                        ><X className="size-4" /></button>
                        <button
                          onClick={() => setDecision(c.id, "shared")}
                          title="Share to client"
                          className={`size-8 grid place-items-center rounded-md transition ${decision === "shared" ? "bg-info/20 text-info" : "hover:bg-info/10 text-muted-foreground hover:text-info"}`}
                        ><Send className="size-4" /></button>
                        <button
                          onClick={() => setDecision(c.id, "returned")}
                          title="Return to database"
                          className={`size-8 grid place-items-center rounded-md transition ${decision === "returned" ? "bg-secondary text-foreground" : "hover:bg-secondary text-muted-foreground hover:text-foreground"}`}
                        ><Undo2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {scoutOpen && <AIScoutModal onClose={() => setScoutOpen(false)} title={position.title} />}
      {resumeFor && (() => {
        const cand = position.candidates.find(x => x.id === resumeFor);
        if (!cand) return null;
        const d = detailFor(cand);
        return <ResumePreviewModal onClose={() => setResumeFor(null)} candidate={cand} detail={d} />;
      })()}
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
function ResumePreviewModal({
  onClose,
  candidate,
  detail,
}: {
  onClose: () => void;
  candidate: { name: string; initials: string; role: string; experience: string; location: string; matchScore: number };
  detail: { salary: string; prevOrg: string; noticePeriod: string; resumeSummary: string; source: string };
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-xs font-semibold">
              {candidate.initials}
            </div>
            <div>
              <div className="font-semibold">{candidate.name}</div>
              <div className="text-xs text-muted-foreground">{candidate.role} · {candidate.experience}</div>
            </div>
          </div>
          <button onClick={onClose} className="size-9 grid place-items-center rounded-md hover:bg-secondary"><X className="size-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <Kv label="Location" value={candidate.location} />
            <Kv label="Salary" value={detail.salary} />
            <Kv label="Notice" value={detail.noticePeriod} />
            <Kv label="Previous org" value={detail.prevOrg} />
            <Kv label="AI match" value={`${candidate.matchScore}%`} />
            <Kv label="Source" value={detail.source} />
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
              <FileText className="size-3.5" /> Resume preview
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{detail.resumeSummary}</p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="h-9 px-4 rounded-md border border-border text-sm">Close</button>
            <button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-1.5">
              <FileText className="size-4" /> Open full CV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
