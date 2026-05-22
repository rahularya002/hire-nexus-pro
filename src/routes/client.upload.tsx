import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, FileUp, Sparkles, CheckCircle2, ArrowLeft, Loader2, MapPin, Briefcase, Building2 } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { scoutCandidates, type ScoutCandidate } from "@/lib/scout-match.functions";
import { createPosition } from "@/lib/positions.functions";
import { createDocument } from "@/lib/documents.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/upload")({
  component: () => <ClientShell><Page /></ClientShell>,
});

function Page() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    jobTitle: "",
    location: "",
    experience: "",
    salary: "",
    openings: "",
    priority: "High",
    skills: "",
    jd: "",
  });
  const [scouting, setScouting] = useState(false);
  const [scoutError, setScoutError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ScoutCandidate[] | null>(null);
  const runScout = useServerFn(scoutCandidates);
  const createPositionFn = useServerFn(createPosition);
  const createDocumentFn = useServerFn(createDocument);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleRunScout() {
    if (!form.jobTitle.trim()) {
      setScoutError("Add a job title first so Scout knows what to look for.");
      return;
    }
    setScouting(true);
    setScoutError(null);
    setCandidates(null);
    try {
      const res = await runScout({
        data: {
          jobTitle: form.jobTitle,
          location: form.location,
          experience: form.experience,
          skills: form.skills,
          jd: form.jd,
          fileName: file?.name ?? null,
        },
      });
      if (res.error) setScoutError(res.error);
      setCandidates(res.candidates);
    } catch (e) {
      setScoutError(e instanceof Error ? e.message : "Talent Scout failed.");
    } finally {
      setScouting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setSaveError("You must be signed in.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // Find the client row linked to this user
      const { data: clientRow, error: clientErr } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (clientErr) throw clientErr;
      if (!clientRow?.id) throw new Error("No client account linked to your login.");

      const priority = (form.priority.toLowerCase() as "high" | "medium" | "low");
      const position = await createPositionFn({
        data: {
          client_id: clientRow.id,
          title: form.jobTitle,
          location: form.location || null,
          experience: form.experience || null,
          salary: form.salary || null,
          openings: form.openings ? Math.max(1, parseInt(form.openings, 10) || 1) : 1,
          priority,
          status: "open",
          description: form.jd || null,
          skills: form.skills
            ? form.skills.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30)
            : [],
        },
      });

      if (file) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${clientRow.id}/jd/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        await createDocumentFn({
          data: {
            name: file.name,
            kind: "jd",
            client_id: clientRow.id,
            position_id: position.id,
            storage_bucket: "documents",
            storage_path: path,
            mime: file.type || "application/octet-stream",
            size_bytes: file.size,
            required: false,
            received: true,
          },
        });
      }
      setSubmitted(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to submit JD.");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <div className="size-16 rounded-full bg-success/15 grid place-items-center mx-auto">
          <CheckCircle2 className="size-8 text-success" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mt-6">JD submitted successfully</h1>
        <p className="text-sm text-muted-foreground mt-2">Your TalentFlow recruiter has been notified in real-time. You'll see the first shortlisted candidates within 48 hours.</p>
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => navigate({ to: "/client" })} className="h-10 px-4 rounded-md border border-border text-sm font-medium">Back to dashboard</button>
          <button onClick={() => { setSubmitted(false); setFile(null); }} className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium">Upload another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate({ to: "/client" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Dashboard
      </button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload new job description</h1>
        <p className="text-sm text-muted-foreground mt-1">Fill in the role details below. Your recruiter will be notified instantly.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* JD file dropzone */}
        <div className="rounded-xl border-2 border-dashed border-border bg-card p-6 hover:border-primary/40 transition">
          <label className="flex items-center gap-4 cursor-pointer">
            <div className="size-12 rounded-lg bg-primary/10 grid place-items-center text-primary">
              <FileUp className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{file?.name ?? "Drop your JD PDF here"}</div>
              <div className="text-xs text-muted-foreground">or click to browse · PDF, DOCX up to 10MB</div>
            </div>
            <span className="text-xs text-primary font-medium">Browse</span>
            <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="text-sm font-medium">Or fill the form manually</span>
            <span className="ml-auto text-xs text-muted-foreground">Auto-saved</span>
          </div>
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <Field label="Job title" placeholder="e.g. Head of E-commerce" full required value={form.jobTitle} onChange={(v) => set("jobTitle", v)} />
            <Field label="Location" placeholder="Mumbai, Bengaluru..." value={form.location} onChange={(v) => set("location", v)} />
            <Field label="Experience required" placeholder="e.g. 10-15 years" value={form.experience} onChange={(v) => set("experience", v)} />
            <Field label="Salary range" placeholder="₹40-60 LPA" value={form.salary} onChange={(v) => set("salary", v)} />
            <Field label="No. of openings" placeholder="1" type="number" value={form.openings} onChange={(v) => set("openings", v)} />
            <Select label="Priority" options={["High", "Medium", "Low"]} value={form.priority} onChange={(v) => set("priority", v)} />
            <Field label="Required skills" placeholder="React, D2C, Leadership..." full value={form.skills} onChange={(v) => set("skills", v)} />
            <Textarea label="Job description" placeholder="Describe the role, responsibilities and ideal candidate..." value={form.jd} onChange={(v) => set("jd", v)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => navigate({ to: "/client" })} className="h-10 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button
            type="button"
            onClick={handleRunScout}
            disabled={scouting}
            className="h-10 inline-flex items-center gap-2 px-5 rounded-md border border-primary/40 bg-gradient-to-br from-primary/10 via-purple/10 to-info/10 text-primary text-sm font-medium hover:bg-primary/15 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {scouting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {scouting ? "Scouting candidates..." : "Run Talent Scout"}
          </button>
          <button type="submit" disabled={saving} className="h-10 inline-flex items-center gap-2 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {saving ? "Submitting…" : "Submit JD"}
          </button>
        </div>
        {saveError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm px-3 py-2">{saveError}</div>
        )}
      </form>

      {(scouting || scoutError || candidates) && (
        <ScoutResults loading={scouting} error={scoutError} candidates={candidates} />
      )}
    </div>
  );
}

function Field({ label, placeholder, type = "text", full, required, value, onChange }: { label: string; placeholder: string; type?: string; full?: boolean; required?: boolean; value: string; onChange: (v: string) => void }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="text-xs font-medium">{label} {required && <span className="text-destructive">*</span>}</label>
      <input type={type} placeholder={placeholder} required={required} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
    </div>
  );
}

function Select({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Textarea({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="sm:col-span-2">
      <label className="text-xs font-medium">{label}</label>
      <textarea rows={5} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
    </div>
  );
}

function ScoutResults({
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
          <div className="text-xs text-muted-foreground">Generated from your role brief — review and shortlist with your recruiter.</div>
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