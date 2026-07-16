import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Database, Search, Briefcase, MapPin, Building2, Plus, Loader2, SearchX, CheckCircle2, XCircle, Send, CalendarClock, Trophy, History as HistoryIcon, X, Pencil, FileText, Upload, FileSpreadsheet, Download } from "lucide-react";
import { TableRowsSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  createCandidate,
  listCandidates,
  listApplications,
  updateCandidate,
  getResumeSignedUrl,
  STAGE_LABEL,
  type ApplicationRow,
  type ApplicationStage,
  type CandidateRow,
} from "@/lib/candidates.functions";
import { createDocument } from "@/lib/documents.functions";
import { uploadCvFile } from "@/lib/upload-cv";
import { initialsOf } from "@/lib/display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { EditCandidateDialog } from "@/components/edit-candidate-dialog";

export const Route = createFileRoute("/database")({
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const [q, setQ] = useState("");
  const [locFilter, setLocFilter] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selected, setSelected] = useState<CandidateRow | null>(null);
  const fetchCandidates = useServerFn(listCandidates);
  const addCandidate = useServerFn(createCandidate);
  const qc = useQueryClient();
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => fetchCandidates(),
  });

  const create = useMutation({
    mutationFn: (data: { name: string; email?: string; phone?: string; role?: string; location?: string; experience?: string; current_company?: string; linkedin_url?: string; salary?: string; salary_min?: number | null; salary_max?: number | null; skills?: string[]; resume_url?: string }) =>
      addCandidate({ data }),
    onSuccess: () => {
      toast.success("Candidate added");
      qc.invalidateQueries({ queryKey: ["candidates"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    const loc = locFilter.toLowerCase().trim();
    const minF = salaryMin.trim() === "" ? null : Number(salaryMin);
    const maxF = salaryMax.trim() === "" ? null : Number(salaryMax);
    return candidates.filter((c) => {
      if (needle) {
        const hay = [c.name, c.role, c.location, c.email, c.current_company, c.phone, ...(c.skills ?? [])]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(needle));
        if (!hay) return false;
      }
      if (loc) {
        if (!c.location || !c.location.toLowerCase().includes(loc)) return false;
      }
      if (minF != null || maxF != null) {
        const cMin = c.salary_min ?? c.salary_max ?? null;
        const cMax = c.salary_max ?? c.salary_min ?? null;
        if (cMin == null && cMax == null) return false;
        if (minF != null && (cMax ?? -Infinity) < minF) return false;
        if (maxF != null && (cMin ?? Infinity) > maxF) return false;
      }
      return true;
    });
  }, [candidates, q, locFilter, salaryMin, salaryMax]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Talent intelligence</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
            <Database className="size-5 text-primary" /> Candidate database
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Structured pool of every sourced candidate, persisted in your backend.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-2">
            <FileSpreadsheet className="size-4" /> Bulk import
          </Button>
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="size-4" /> Add candidate</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, role, company, location, email…"
            className="w-full h-10 rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} candidates</span>
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="grid gap-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Location</Label>
          <div className="relative">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={locFilter}
              onChange={(e) => setLocFilter(e.target.value)}
              placeholder="e.g. Bengaluru"
              className="h-9 pl-8 w-52"
            />
          </div>
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Salary min (LPA)</Label>
          <Input
            type="number"
            min={0}
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            placeholder="0"
            className="h-9 w-32"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Salary max (LPA)</Label>
          <Input
            type="number"
            min={0}
            value={salaryMax}
            onChange={(e) => setSalaryMax(e.target.value)}
            placeholder="∞"
            className="h-9 w-32"
          />
        </div>
        {(locFilter || salaryMin || salaryMax) && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs"
            onClick={() => { setLocFilter(""); setSalaryMin(""); setSalaryMax(""); }}>
            <X className="size-3.5" /> Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Candidate</th>
                <th className="text-left font-medium px-2 py-2.5">Role / experience</th>
                <th className="text-left font-medium px-2 py-2.5">Location</th>
                <th className="text-left font-medium px-2 py-2.5">Current company</th>
                <th className="text-left font-medium px-2 py-2.5">Source</th>
                <th className="text-left font-medium px-2 py-2.5">CV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <TableRowsSkeleton rows={6} cols={6} />
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8">
                  <EmptyState
                    icon={q ? SearchX : Database}
                    title={q ? "No matches found" : "No candidates yet"}
                    description={
                      q
                        ? `Nothing matches "${q}". Try a different name, skill, or company.`
                        : "Click \"Add candidate\" to seed your talent pool."
                    }
                    className="border-0 bg-transparent p-0"
                  />
                </td></tr>
              )}
              {filtered.map((c: CandidateRow) => (
                <tr
                  key={c.id}
                  className="hover:bg-secondary/30 transition cursor-pointer"
                  onClick={() => setSelected(c)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-gradient-to-br from-primary/40 to-purple/40 grid place-items-center text-[11px] font-semibold">
                        {initialsOf(c.name)}
                      </div>
                      <div className="leading-tight">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground">{c.email ?? "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="text-xs">{c.role ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <Briefcase className="size-3" />{c.experience ?? "—"}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3 text-muted-foreground" />{c.location ?? "—"}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="size-3 text-muted-foreground" />{c.current_company ?? "—"}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-xs capitalize">{c.source}</td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <CvCellButton candidate={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddCandidateDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(d) => create.mutate(d)}
        submitting={create.isPending}
      />
      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
      />
      <CandidateDetailSheet
        candidate={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function CandidateDetailSheet({
  candidate,
  onClose,
}: {
  candidate: CandidateRow | null;
  onClose: () => void;
}) {
  const fetchApps = useServerFn(listApplications);
  const [editing, setEditing] = useState(false);
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["candidate-history", candidate?.id],
    queryFn: () => fetchApps({ data: { candidateId: candidate!.id } }),
    enabled: !!candidate,
  });

  return (
    <Sheet open={!!candidate} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {candidate && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gradient-to-br from-primary/40 to-purple/40 grid place-items-center text-sm font-semibold">
                  {initialsOf(candidate.name)}
                </div>
                <div className="leading-tight">
                  <div>{candidate.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {candidate.role ?? "—"}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </SheetTitle>
              <SheetDescription className="sr-only">Candidate details and history</SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="profile" className="mt-5">
              <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5">
                  History
                  {apps.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                      {apps.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="space-y-2 text-sm">
                <Row k="Email" v={candidate.email} />
                <Row k="Phone" v={candidate.phone} />
                <Row k="Experience" v={candidate.experience} />
                <Row k="Location" v={candidate.location} />
                <Row k="Current company" v={candidate.current_company} />
                <Row k="Skills" v={candidate.skills?.length ? candidate.skills.join(", ") : null} />
                <Row k="Source" v={candidate.source} />
                <CvRow candidate={candidate} />
                {candidate.linkedin_url && (
                  <a href={candidate.linkedin_url} target="_blank" rel="noreferrer"
                    className="text-primary text-xs underline">View LinkedIn profile</a>
                )}
              </TabsContent>
              <TabsContent value="history" className="space-y-3">
                {isLoading && <div className="text-xs text-muted-foreground py-6">Loading history…</div>}
                {!isLoading && apps.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <HistoryIcon className="size-6 text-muted-foreground mx-auto mb-2" />
                    <div className="text-xs text-muted-foreground">
                      This candidate hasn't been shared with any client yet.
                    </div>
                  </div>
                )}
                {!isLoading && apps.length > 0 && <HistorySummary apps={apps} />}
                <ul className="space-y-2">
                  {[...apps]
                    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
                    .map((a: ApplicationRow) => (
                      <HistoryItem key={a.id} app={a} />
                    ))}
                </ul>
              </TabsContent>
            </Tabs>
            <EditCandidateDialog
              open={editing}
              onOpenChange={setEditing}
              candidate={candidate}
              invalidateKeys={[["candidates"], ["candidate-history", candidate.id]]}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex gap-3 py-1">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{k}</span>
      <span className="text-xs">{v ?? "—"}</span>
    </div>
  );
}

function CvRow({ candidate }: { candidate: CandidateRow }) {
  const qc = useQueryClient();
  const signFn = useServerFn(getResumeSignedUrl);
  const updateFn = useServerFn(updateCandidate);
  const createDocFn = useServerFn(createDocument);
  const [opening, setOpening] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function openCv() {
    setOpening(true);
    try {
      const { url } = await signFn({ data: { candidateId: candidate.id } });
      if (!url) throw new Error("No CV on file");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open CV");
    } finally {
      setOpening(false);
    }
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    setUploading(true);
    try {
      const up = await uploadCvFile(f);
      await updateFn({ data: { id: candidate.id, resume_url: up.path } });
      await createDocFn({
        data: {
          name: up.name,
          kind: "resume",
          candidate_id: candidate.id,
          storage_bucket: "documents",
          storage_path: up.path,
          mime: up.mime,
          size_bytes: up.size,
        },
      });
      toast.success("CV uploaded");
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidate-history", candidate.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex gap-3 py-1 items-center">
      <span className="text-xs text-muted-foreground w-32 shrink-0">CV / Resume</span>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      {candidate.resume_url ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={openCv} disabled={opening}>
            {opening ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3.5" />}
            Open CV
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3.5" />}
            Replace
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3.5" />}
          Upload CV
        </Button>
      )}
    </div>
  );
}

const STAGE_META: Partial<Record<ApplicationStage, { tone: string; Icon: typeof Send }>> = {
  shared_with_client:   { tone: "bg-info/15 text-info",          Icon: Send },
  client_shortlist:     { tone: "bg-emerald-500/15 text-emerald-600", Icon: CheckCircle2 },
  client_rejected:      { tone: "bg-destructive/15 text-destructive", Icon: XCircle },
  interview_scheduled:  { tone: "bg-purple/15 text-purple",      Icon: CalendarClock },
  rounds:               { tone: "bg-purple/15 text-purple",      Icon: CalendarClock },
  offered:              { tone: "bg-emerald-500/15 text-emerald-600", Icon: Trophy },
  closed:               { tone: "bg-secondary text-secondary-foreground", Icon: CheckCircle2 },
};

function HistorySummary({ apps }: { apps: ApplicationRow[] }) {
  const clients = new Set(apps.map((a) => a.position?.client?.id).filter(Boolean));
  const shortlisted = apps.filter((a) => ["client_shortlist", "interview_scheduled", "rounds", "offered"].includes(a.stage)).length;
  const rejected = apps.filter((a) => a.stage === "client_rejected").length;
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Clients" value={clients.size} />
      <Stat label="Shortlisted" value={shortlisted} tone="text-emerald-600" />
      <Stat label="Rejected" value={rejected} tone="text-destructive" />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <div className={`text-lg font-semibold leading-none ${tone ?? ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function HistoryItem({ app: a }: { app: ApplicationRow }) {
  const meta = STAGE_META[a.stage] ?? { tone: "bg-secondary text-secondary-foreground", Icon: Send };
  const Icon = meta.Icon;
  const dot = a.position?.client?.color ?? "hsl(var(--muted-foreground))";
  const rejected = a.stage === "client_rejected";
  const date = new Date(a.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return (
    <li className="rounded-lg border border-border bg-card p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2 rounded-full shrink-0" style={{ background: dot }} />
          <div className="text-sm font-medium truncate">{a.position?.client?.name ?? "Client"}</div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.tone}`}>
          <Icon className="size-3" />
          {STAGE_LABEL[a.stage] ?? a.stage}
        </span>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
        <span className="truncate">{a.position?.title ?? "—"}</span>
        {a.match_score != null && <span>· {a.match_score}% match</span>}
        <span>· {date}</span>
      </div>
      {rejected && a.notes && (
        <div className="text-xs text-destructive/90 rounded-md bg-destructive/5 border border-destructive/15 px-2 py-1.5">
          <span className="font-medium">Reason:</span> {a.notes}
        </div>
      )}
    </li>
  );
}

function AddCandidateDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (d: { name: string; email?: string; phone?: string; role?: string; location?: string; experience?: string; current_company?: string; linkedin_url?: string; salary?: string; skills?: string[]; resume_url?: string }) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "", location: "", experience: "", current_company: "", linkedin_url: "", salary: "" });
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const createDocFn = useServerFn(createDocument);

  function addSkill() {
    const v = skillInput.trim();
    if (!v || skills.includes(v)) { setSkillInput(""); return; }
    setSkills([...skills, v].slice(0, 40));
    setSkillInput("");
  }

  function reset() {
    setForm({ name: "", email: "", phone: "", role: "", location: "", experience: "", current_company: "", linkedin_url: "", salary: "" });
    setSkills([]);
    setSkillInput("");
    setCvFile(null);
  }

  async function handleSubmit() {
    let resumePath: string | undefined;
    if (cvFile) {
      setUploadingCv(true);
      try {
        const up = await uploadCvFile(cvFile);
        resumePath = up.path;
        // Best-effort document record; attach candidate_id afterwards would need id, skip here.
        try {
          await createDocFn({ data: {
            name: up.name, kind: "resume",
            storage_bucket: "documents", storage_path: up.path,
            mime: up.mime, size_bytes: up.size,
          }});
        } catch { /* non-fatal */ }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "CV upload failed");
        setUploadingCv(false);
        return;
      }
      setUploadingCv(false);
    }
    onSubmit({
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      role: form.role.trim() || undefined,
      location: form.location.trim() || undefined,
      experience: form.experience.trim() || undefined,
      current_company: form.current_company.trim() || undefined,
      linkedin_url: form.linkedin_url.trim() || undefined,
      salary: form.salary.trim() || undefined,
      skills: skills.length ? skills : undefined,
      resume_url: resumePath,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add candidate</DialogTitle>
          <DialogDescription>Add a new candidate to your talent database.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Field label="Name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Current role"><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
            <Field label="Current company"><Input value={form.current_company} onChange={(e) => setForm({ ...form, current_company: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Experience"><Input value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} placeholder="e.g. 7 yrs" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="LinkedIn URL"><Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/…" /></Field>
            <Field label="Salary / CTC"><Input value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="₹50 LPA" /></Field>
          </div>
          <Field label="Skills">
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                placeholder="Add a skill and press Enter"
              />
              <Button type="button" variant="outline" onClick={addSkill}><Plus className="size-4" /></Button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {skills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-secondary font-medium">
                    {s}
                    <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))} className="text-muted-foreground hover:text-foreground">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
          <Field label="CV / Resume (PDF, DOC, DOCX, TXT — max 10 MB)">
            <div className="flex items-center gap-2">
              <Input type="file" accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setCvFile(e.target.files?.[0] ?? null)} />
              {cvFile && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setCvFile(null)}>
                  <X className="size-4" />
                </Button>
              )}
            </div>
            {cvFile && (
              <div className="text-[11px] text-muted-foreground mt-1 truncate">
                <FileText className="inline size-3 mr-1" />{cvFile.name} · {(cvFile.size / 1024).toFixed(0)} KB
              </div>
            )}
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={submitting || uploadingCv || !form.name.trim()}
            onClick={handleSubmit}
          >
            {submitting || uploadingCv ? <Loader2 className="size-4 animate-spin" /> : "Add candidate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function CvCellButton({ candidate }: { candidate: CandidateRow }) {
  const qc = useQueryClient();
  const signFn = useServerFn(getResumeSignedUrl);
  const updateFn = useServerFn(updateCandidate);
  const createDocFn = useServerFn(createDocument);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const { url } = await signFn({ data: { candidateId: candidate.id } });
      if (!url) throw new Error("No CV on file");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open CV");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    setBusy(true);
    try {
      const up = await uploadCvFile(f);
      await updateFn({ data: { id: candidate.id, resume_url: up.path } });
      await createDocFn({ data: {
        name: up.name, kind: "resume", candidate_id: candidate.id,
        storage_bucket: "documents", storage_path: up.path,
        mime: up.mime, size_bytes: up.size,
      }}).catch(() => {});
      toast.success("CV uploaded");
      qc.invalidateQueries({ queryKey: ["candidates"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      {candidate.resume_url ? (
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={open} disabled={busy}
          title="Open CV">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5 text-primary" />}
          Open
        </Button>
      ) : (
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={() => fileRef.current?.click()} disabled={busy} title="Upload CV">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          Upload
        </Button>
      )}
    </>
  );
}

type BulkRow = {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  location?: string;
  experience?: string;
  current_company?: string;
  linkedin_url?: string;
  salary?: string;
  skills?: string[];
  _error?: string;
};

const BULK_COLUMNS: { key: keyof BulkRow; aliases: string[] }[] = [
  { key: "name", aliases: ["name", "full name", "candidate", "candidate name"] },
  { key: "email", aliases: ["email", "email address", "e-mail"] },
  { key: "phone", aliases: ["phone", "mobile", "contact", "phone number"] },
  { key: "role", aliases: ["role", "current role", "title", "job title", "designation"] },
  { key: "current_company", aliases: ["company", "current company", "employer", "organisation", "organization"] },
  { key: "location", aliases: ["location", "city", "based in"] },
  { key: "experience", aliases: ["experience", "years of experience", "exp", "yoe"] },
  { key: "linkedin_url", aliases: ["linkedin", "linkedin url", "linkedin profile"] },
  { key: "salary", aliases: ["salary", "ctc", "compensation", "package"] },
  { key: "skills", aliases: ["skills", "key skills", "tech stack"] },
];

function normHeader(h: string) {
  return String(h ?? "").trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
}

function mapRow(raw: Record<string, unknown>): BulkRow {
  const out: BulkRow = { name: "" };
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) normalized[normHeader(k)] = v;
  for (const col of BULK_COLUMNS) {
    for (const alias of col.aliases) {
      if (alias in normalized && normalized[alias] != null && String(normalized[alias]).trim() !== "") {
        const val = String(normalized[alias]).trim();
        if (col.key === "skills") {
          out.skills = val.split(/[,;|]/).map((s) => s.trim()).filter(Boolean).slice(0, 40);
        } else {
          (out as Record<string, unknown>)[col.key] = val;
        }
        break;
      }
    }
  }
  if (!out.name) out._error = "Missing name";
  return out;
}

function BulkImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const addCandidate = useServerFn(createCandidate);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; ok: number; failed: number } | null>(null);

  function reset() {
    setRows([]); setFileName(""); setProgress(null);
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    setParsing(true);
    setFileName(f.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const mapped = json.map(mapRow).filter((r) => r.name || r._error);
      if (mapped.length === 0) throw new Error("No rows found. Make sure the first sheet has a header row.");
      setRows(mapped);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse file");
      setFileName("");
    } finally {
      setParsing(false);
    }
  }

  function downloadTemplate() {
    // Simple CSV template — Excel opens it natively.
    const headers = ["name", "email", "phone", "role", "current_company", "location", "experience", "linkedin_url", "salary", "skills"];
    const sample = ["Jane Doe", "jane@example.com", "+91 90000 00000", "Senior Engineer", "Acme", "Bengaluru", "7 years", "https://linkedin.com/in/jane", "₹40 LPA", "React, Node, TypeScript"];
    const csv = headers.join(",") + "\n" + sample.map((v) => `"${v.replace(/"/g, '""')}"`).join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "candidates-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    const valid = rows.filter((r) => !r._error);
    if (valid.length === 0) { toast.error("Nothing valid to import"); return; }
    setImporting(true);
    let ok = 0, failed = 0;
    setProgress({ done: 0, ok: 0, failed: 0 });
    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      try {
        await addCandidate({ data: {
          name: r.name,
          email: r.email, phone: r.phone, role: r.role,
          location: r.location, experience: r.experience,
          current_company: r.current_company, linkedin_url: r.linkedin_url,
          salary: r.salary, skills: r.skills,
        }});
        ok++;
      } catch (e) {
        failed++;
        // Attach message back onto the row for UI
        r._error = e instanceof Error ? e.message : "Failed";
      }
      setProgress({ done: i + 1, ok, failed });
    }
    setImporting(false);
    qc.invalidateQueries({ queryKey: ["candidates"] });
    toast.success(`Imported ${ok} · ${failed} failed`);
    if (failed === 0) {
      reset();
      onOpenChange(false);
    }
  }

  const validCount = rows.filter((r) => !r._error).length;
  const errorCount = rows.length - validCount;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" /> Bulk import candidates
          </DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx, .xls) or CSV file. First row must be a header row with columns like <code>name</code>, <code>email</code>, <code>phone</code>, <code>role</code>, <code>skills</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              disabled={parsing || importing}
              className="max-w-sm" />
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
              <Download className="size-3.5" /> Download template
            </Button>
            {parsing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">{fileName}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                  <CheckCircle2 className="size-3" /> {validCount} valid
                </span>
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                    <XCircle className="size-3" /> {errorCount} issue{errorCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <div className="rounded-lg border border-border overflow-hidden max-h-[360px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">#</th>
                      <th className="text-left font-medium px-2 py-2">Name</th>
                      <th className="text-left font-medium px-2 py-2">Email</th>
                      <th className="text-left font-medium px-2 py-2">Role</th>
                      <th className="text-left font-medium px-2 py-2">Company</th>
                      <th className="text-left font-medium px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r, i) => (
                      <tr key={i} className={r._error ? "bg-destructive/5" : ""}>
                        <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-1.5 font-medium">{r.name || <span className="text-destructive">—</span>}</td>
                        <td className="px-2 py-1.5">{r.email ?? "—"}</td>
                        <td className="px-2 py-1.5">{r.role ?? "—"}</td>
                        <td className="px-2 py-1.5">{r.current_company ?? "—"}</td>
                        <td className="px-2 py-1.5">
                          {r._error ? (
                            <span className="text-destructive">{r._error}</span>
                          ) : (
                            <span className="text-emerald-600">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {progress && (
                <div className="text-xs text-muted-foreground">
                  Progress: {progress.done} / {validCount} · {progress.ok} added · {progress.failed} failed
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>Cancel</Button>
          <Button
            onClick={runImport}
            disabled={importing || parsing || validCount === 0}
            className="gap-2"
          >
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Import {validCount > 0 ? `${validCount} candidate${validCount === 1 ? "" : "s"}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}