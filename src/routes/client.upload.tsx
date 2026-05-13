import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileUp, Sparkles, CheckCircle2, ArrowLeft } from "lucide-react";
import { ClientShell } from "@/components/client-shell";

export const Route = createFileRoute("/client/upload")({
  component: () => <ClientShell><Page /></ClientShell>,
});

function Page() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState<string | null>(null);

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

      <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-6">
        {/* JD file dropzone */}
        <div className="rounded-xl border-2 border-dashed border-border bg-card p-6 hover:border-primary/40 transition">
          <label className="flex items-center gap-4 cursor-pointer">
            <div className="size-12 rounded-lg bg-primary/10 grid place-items-center text-primary">
              <FileUp className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{file ?? "Drop your JD PDF here"}</div>
              <div className="text-xs text-muted-foreground">or click to browse · PDF, DOCX up to 10MB</div>
            </div>
            <span className="text-xs text-primary font-medium">Browse</span>
            <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
          </label>
        </div>

        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="text-sm font-medium">Or fill the form manually</span>
            <span className="ml-auto text-xs text-muted-foreground">Auto-saved</span>
          </div>
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <Field label="Job title" placeholder="e.g. Head of E-commerce" full required />
            <Field label="Location" placeholder="Mumbai, Bengaluru..." />
            <Field label="Experience required" placeholder="e.g. 10-15 years" />
            <Field label="Salary range" placeholder="₹40-60 LPA" />
            <Field label="No. of openings" placeholder="1" type="number" />
            <Select label="Priority" options={["High", "Medium", "Low"]} />
            <Field label="Required skills" placeholder="React, D2C, Leadership..." full />
            <Textarea label="Job description" placeholder="Describe the role, responsibilities and ideal candidate..." />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => navigate({ to: "/client" })} className="h-10 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" className="h-10 inline-flex items-center gap-2 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Upload className="size-4" /> Submit JD
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, placeholder, type = "text", full, required }: { label: string; placeholder: string; type?: string; full?: boolean; required?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="text-xs font-medium">{label} {required && <span className="text-destructive">*</span>}</label>
      <input type={type} placeholder={placeholder} required={required}
        className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
    </div>
  );
}

function Select({ label, options }: { label: string; options: string[] }) {
  return (
    <div>
      <label className="text-xs font-medium">{label}</label>
      <select className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Textarea({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div className="sm:col-span-2">
      <label className="text-xs font-medium">{label}</label>
      <textarea rows={5} placeholder={placeholder}
        className="mt-1.5 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
    </div>
  );
}