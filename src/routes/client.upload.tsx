import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, FileUp, Sparkles, CheckCircle2, ArrowLeft, Loader2, FileText, ChevronDown } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { createPosition } from "@/lib/positions.functions";
import { createDocument } from "@/lib/documents.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { parseJdFile, extractFieldsFromJd } from "@/lib/parse-jd";
import { extractJdWithAi } from "@/lib/jd-extract.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/client/upload")({
  component: () => <ClientShell><Page /></ClientShell>,
});

function Page() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>("INR");
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
  const createPositionFn = useServerFn(createPosition);
  const createDocumentFn = useServerFn(createDocument);
  const extractJdAiFn = useServerFn(extractJdWithAi);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleFile(f: File | null) {
    if (!f) return;
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    const ALLOWED = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    const okExt = /\.(pdf|docx?|txt)$/i.test(f.name);
    if (!okExt && f.type && !ALLOWED.includes(f.type)) {
      toast.error("Unsupported file type. Upload PDF, DOC, DOCX, or TXT.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error(`File is too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`);
      return;
    }
    setFile(f);
    setParsing(true);
    setSaveError(null);
    try {
      const text = await parseJdFile(f);
      if (!text) {
        toast.error("Couldn't read this file. Please fill the form manually.");
        return;
      }
      const extracted = extractFieldsFromJd(text);
      // AI extraction — far better on unstructured JDs. Falls back silently on error.
      let ai: Awaited<ReturnType<typeof extractJdAiFn>> = {};
      try {
        ai = await extractJdAiFn({ data: { text: text.slice(0, 18_000) } });
      } catch (err) {
        console.warn("AI JD extract failed, falling back to regex:", err);
      }
      const pick = (aiVal: string | null | undefined, regexVal: string | undefined) =>
        (aiVal && aiVal.trim()) || regexVal || "";
      const skillsStr = ai.skills?.length ? ai.skills.join(", ") : extracted.skills ?? "";
      setForm((prev) => {
        const next = { ...prev };
        if (!prev.jd.trim()) next.jd = text.slice(0, 15_000);
        const jobTitle = pick(ai.jobTitle, extracted.jobTitle);
        if (!prev.jobTitle.trim() && jobTitle) next.jobTitle = jobTitle;
        const location = pick(ai.location, extracted.location);
        if (!prev.location.trim() && location) next.location = location;
        const experience = pick(ai.experience, extracted.experience);
        if (!prev.experience.trim() && experience) next.experience = experience;
        const salary = pick(ai.salary, extracted.salary);
        if (!prev.salary.trim() && salary) {
          const { currency: detected, amount } = splitSalary(salary);
          if (detected) setCurrency(detected);
          next.salary = amount;
        }
        const openings = pick(ai.openings, extracted.openings);
        if (!prev.openings.trim() && openings) next.openings = openings;
        if (!prev.skills.trim() && skillsStr) next.skills = skillsStr;
        return next;
      });
      const filledFields = ["jobTitle", "location", "experience", "salary", "openings"].filter(
        (k) => (ai as Record<string, unknown>)[k] || (extracted as Record<string, unknown>)[k],
      ).length + ((ai.skills?.length || extracted.skills) ? 1 : 0);
      const filled = filledFields;
      toast.success(filled > 0
        ? `Auto-filled ${filled} field${filled === 1 ? "" : "s"} from your JD — review and submit.`
        : "JD attached. Review the form below before submitting.");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't read this file. Please fill the form manually.");
    } finally {
      setParsing(false);
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
      const combinedSalary = form.salary.trim()
        ? `${CURRENCIES.find((c) => c.code === currency)?.symbol ?? ""} ${form.salary.trim()}`.trim()
        : null;
      const position = await createPositionFn({
        data: {
          client_id: clientRow.id,
          title: form.jobTitle,
          location: form.location || null,
          experience: form.experience || null,
          salary: combinedSalary,
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

      {/* JD format guide */}
      <div className="rounded-xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setGuideOpen((o) => !o)}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          <div className="size-9 rounded-lg bg-primary/10 grid place-items-center text-primary">
            <FileText className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">How to format your JD for best auto-fill</div>
            <div className="text-xs text-muted-foreground">A clear structure helps us extract details automatically.</div>
          </div>
          <ChevronDown className={cn("size-4 text-muted-foreground transition", guideOpen && "rotate-180")} />
        </button>
        {guideOpen && (
          <div className="px-4 pb-4 -mt-1">
            <div className="rounded-lg bg-secondary/40 border border-border p-4 text-sm">
              <p className="text-muted-foreground mb-3">Include these sections, each on its own line with a label and colon:</p>
              <ul className="space-y-1.5 text-foreground/90">
                <li><span className="font-medium">Job title:</span> Senior React Engineer</li>
                <li><span className="font-medium">Location:</span> Bengaluru / Remote</li>
                <li><span className="font-medium">Experience:</span> 5–8 years</li>
                <li><span className="font-medium">Salary:</span> ₹30–45 LPA (or $120k–150k)</li>
                <li><span className="font-medium">Openings:</span> 2</li>
                <li><span className="font-medium">Skills:</span> React, TypeScript, Node.js, AWS</li>
                <li><span className="font-medium">Job description:</span> responsibilities, must-haves, nice-to-haves</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* JD file dropzone */}
        <div className="rounded-xl border-2 border-dashed border-border bg-card p-6 hover:border-primary/40 transition">
          <label className="flex items-center gap-4 cursor-pointer">
            <div className="size-12 rounded-lg bg-primary/10 grid place-items-center text-primary">
              {parsing ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {parsing ? "Reading JD…" : (file?.name ?? "Drop your JD here")}
              </div>
              <div className="text-xs text-muted-foreground">
                {parsing ? "Extracting role details — please wait" : "PDF, DOCX or TXT · we'll auto-fill the form for you"}
              </div>
            </div>
            <span className="text-xs text-primary font-medium">{file ? "Replace" : "Browse"}</span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt"
              disabled={parsing}
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
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
            <SalaryField currency={currency} onCurrencyChange={setCurrency} value={form.salary} onChange={(v) => set("salary", v)} />
            <OpeningsField value={form.openings} onChange={(v) => set("openings", v)} />
            <Select label="Priority" options={["High", "Medium", "Low"]} value={form.priority} onChange={(v) => set("priority", v)} />
            <Field label="Required skills" placeholder="React, D2C, Leadership..." full value={form.skills} onChange={(v) => set("skills", v)} />
            <Textarea label="Job description" placeholder="Describe the role, responsibilities and ideal candidate..." value={form.jd} onChange={(v) => set("jd", v)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => navigate({ to: "/client" })} className="h-10 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={saving} className="h-10 inline-flex items-center gap-2 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {saving ? "Submitting…" : "Submit JD"}
          </button>
        </div>
        {saveError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm px-3 py-2">{saveError}</div>
        )}
      </form>
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

type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD";

const CURRENCIES: { code: CurrencyCode; symbol: string; label: string }[] = [
  { code: "INR", symbol: "₹", label: "INR ₹" },
  { code: "USD", symbol: "$", label: "USD $" },
  { code: "EUR", symbol: "€", label: "EUR €" },
  { code: "GBP", symbol: "£", label: "GBP £" },
  { code: "AED", symbol: "د.إ", label: "AED د.إ" },
  { code: "SGD", symbol: "S$", label: "SGD S$" },
];

function splitSalary(raw: string): { currency: CurrencyCode | null; amount: string } {
  const s = raw.trim();
  if (/^(₹|inr|rs\.?)/i.test(s)) return { currency: "INR", amount: s.replace(/^(₹|inr|rs\.?)\s*/i, "") };
  if (/^s\$/i.test(s)) return { currency: "SGD", amount: s.replace(/^s\$\s*/i, "") };
  if (/^\$/.test(s)) return { currency: "USD", amount: s.replace(/^\$\s*/, "") };
  if (/^€/.test(s)) return { currency: "EUR", amount: s.replace(/^€\s*/, "") };
  if (/^£/.test(s)) return { currency: "GBP", amount: s.replace(/^£\s*/, "") };
  if (/^(aed|د\.إ)/i.test(s)) return { currency: "AED", amount: s.replace(/^(aed|د\.إ)\s*/i, "") };
  return { currency: null, amount: s };
}

function SalaryField({ currency, onCurrencyChange, value, onChange }: { currency: CurrencyCode; onCurrencyChange: (c: CurrencyCode) => void; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium">Salary range</label>
      <div className="mt-1.5 flex gap-2">
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
          className="h-10 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={currency === "INR" ? "40-60 LPA" : "120k-150k"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>
    </div>
  );
}

function OpeningsField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium">No. of openings</label>
      <input
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        placeholder="1"
        value={value}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          if (raw === "") return onChange("");
          const n = Math.max(1, parseInt(raw, 10) || 1);
          onChange(String(n));
        }}
        className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
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