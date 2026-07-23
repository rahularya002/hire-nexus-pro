import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Database, Search, Briefcase, MapPin, Building2, Plus, Loader2, SearchX, CheckCircle2, XCircle, Send, CalendarClock, Trophy, History as HistoryIcon, X, Pencil, FileText, Upload, FileSpreadsheet, Download, UploadCloud } from "lucide-react";
import { CvDropImport, type CvDropImportHandle } from "@/components/cv-drop-import";
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
  attachCvToCandidate,
  STAGE_LABEL,
  type ApplicationRow,
  type ApplicationStage,
  type CandidateRow,
} from "@/lib/candidates.functions";
import { createDocument } from "@/lib/documents.functions";
import { uploadCvFile } from "@/lib/upload-cv";
import { listClients, type ClientRow } from "@/lib/clients.functions";
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
import { NumberInput } from "@/components/ui/number-input";
import { SalaryRange, type SalaryRangeValue } from "@/components/ui/salary-range";
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
  const [salaryRange, setSalaryRange] = useState<SalaryRangeValue>({ min: null, max: null });
  const salaryMin = salaryRange.min == null ? "" : String(salaryRange.min);
  const salaryMax = salaryRange.max == null ? "" : String(salaryRange.max);
  const [clientFilter, setClientFilter] = useState<string>("all"); // "all" | "unassigned" | client_id
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selected, setSelected] = useState<CandidateRow | null>(null);
  const dropRef = useRef<CvDropImportHandle | null>(null);
  const fetchCandidates = useServerFn(listCandidates);
  const addCandidate = useServerFn(createCandidate);
  const fetchClients = useServerFn(listClients);
  const qc = useQueryClient();
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => fetchCandidates(),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });

  const create = useMutation({
    mutationFn: (data: { name: string; email?: string; phone?: string; role?: string; location?: string; experience?: string; current_company?: string; linkedin_url?: string; salary?: string; salary_min?: number | null; salary_max?: number | null; skills?: string[]; resume_url?: string; source_client_id?: string | null }) =>
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
      if (clientFilter === "unassigned") {
        if (c.source_client_id) return false;
      } else if (clientFilter !== "all") {
        if (c.source_client_id !== clientFilter) return false;
      }
      return true;
    });
  }, [candidates, q, locFilter, salaryMin, salaryMax, clientFilter]);

  return (
    <CvDropImport ref={dropRef} className="space-y-5">
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
          <Button variant="outline" onClick={() => dropRef.current?.openPicker()} className="gap-2">
            <UploadCloud className="size-4" /> Upload CVs
          </Button>
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
        <SalaryRange value={salaryRange} onChange={setSalaryRange} />
        <div className="grid gap-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Source client</Label>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 w-52"
          >
            <option value="all">All clients</option>
            <option value="unassigned">Unassigned</option>
            {clients.map((c: ClientRow) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {(locFilter || salaryMin || salaryMax || clientFilter !== "all") && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs"
            onClick={() => { setLocFilter(""); setSalaryRange({ min: null, max: null }); setClientFilter("all"); }}>
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
                <th className="text-left font-medium px-2 py-2.5">Salary range</th>
                <th className="text-left font-medium px-2 py-2.5">Source client</th>
                <th className="text-left font-medium px-2 py-2.5">Source</th>
                <th className="text-left font-medium px-2 py-2.5">CV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <TableRowsSkeleton rows={6} cols={8} />
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8">
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
                  <td className="px-2 py-3 text-xs">{formatSalaryRange(c.salary_min, c.salary_max, c.salary)}</td>
                  <td className="px-2 py-3 text-xs">
                    {c.source_client ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/60 border border-border">
                        <span className="size-1.5 rounded-full" style={{ background: c.source_client.color ?? "hsl(var(--muted-foreground))" }} />
                        <span className="truncate max-w-[140px]">{c.source_client.name}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
        clients={clients}
      />
      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        clients={clients}
      />
      <CandidateDetailSheet
        candidate={selected}
        onClose={() => setSelected(null)}
      />
   </CvDropImport>
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
                <Row k="Salary range" v={formatSalaryRange(candidate.salary_min, candidate.salary_max, candidate.salary)} />
                <Row k="Source client" v={candidate.source_client?.name ?? null} />
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
  clients,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (d: { name: string; email?: string; phone?: string; role?: string; location?: string; experience?: string; current_company?: string; linkedin_url?: string; salary?: string; skills?: string[]; resume_url?: string; source_client_id?: string | null }) => void;
  // salary_min/salary_max are added below in the handler
  submitting: boolean;
  clients: ClientRow[];
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "", location: "", experience: "", current_company: "", linkedin_url: "", salary_min: "", salary_max: "", source_client_id: "" });
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
    setForm({ name: "", email: "", phone: "", role: "", location: "", experience: "", current_company: "", linkedin_url: "", salary_min: "", salary_max: "", source_client_id: "" });
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
      skills: skills.length ? skills : undefined,
      resume_url: resumePath,
      source_client_id: form.source_client_id || null,
      ...(form.salary_min.trim() !== "" ? { salary_min: Number(form.salary_min) } : {}),
      ...(form.salary_max.trim() !== "" ? { salary_max: Number(form.salary_max) } : {}),
    } as Parameters<typeof onSubmit>[0]);
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
            <div className="grid grid-cols-2 gap-2">
              <Field label="Salary min (LPA)"><NumberInput min={0} value={form.salary_min} onChange={(v) => setForm({ ...form, salary_min: v })} placeholder="12" /></Field>
              <Field label="Salary max (LPA)"><NumberInput min={0} value={form.salary_max} onChange={(v) => setForm({ ...form, salary_max: v })} placeholder="18" /></Field>
            </div>
          </div>
          <Field label="Source client (optional)">
            <select
              value={form.source_client_id}
              onChange={(e) => setForm({ ...form, source_client_id: e.target.value })}
              className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            >
              <option value="">— None —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
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

function formatSalaryRange(min: number | null, max: number | null, fallback: string | null): string {
  if (min != null && max != null) {
    return min === max ? `₹${min} LPA` : `₹${min}–${max} LPA`;
  }
  if (min != null) return `≥ ₹${min} LPA`;
  if (max != null) return `≤ ₹${max} LPA`;
  return fallback ?? "—";
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
  salary_min?: number;
  salary_max?: number;
  skills?: string[];
  cv_filename?: string;
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
  { key: "salary_min", aliases: ["salary min", "salary minimum", "min salary", "ctc min", "min ctc", "salary min lpa"] },
  { key: "salary_max", aliases: ["salary max", "salary maximum", "max salary", "ctc max", "max ctc", "salary max lpa"] },
  { key: "skills", aliases: ["skills", "key skills", "tech stack"] },
  { key: "cv_filename", aliases: ["cv", "cv file", "cv filename", "resume", "resume file", "resume filename", "cv name"] },
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
        } else if (col.key === "salary_min" || col.key === "salary_max") {
          const n = Number(val.replace(/[^0-9.]/g, ""));
          if (Number.isFinite(n)) (out as Record<string, unknown>)[col.key] = n;
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

function BulkImportDialog({ open, onOpenChange, clients }: { open: boolean; onOpenChange: (o: boolean) => void; clients: ClientRow[] }) {
  const qc = useQueryClient();
  const addCandidate = useServerFn(createCandidate);
  const attachCv = useServerFn(attachCvToCandidate);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; ok: number; failed: number } | null>(null);
  const [sourceClientId, setSourceClientId] = useState<string>("");
  const [imported, setImported] = useState<{ id: string; name: string; cvFilename?: string }[]>([]);
  const [cvStatuses, setCvStatuses] = useState<Record<string, { status: "queued" | "uploading" | "attached" | "already" | "failed"; candidateName?: string; error?: string }>>({});
  const cvInputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setRows([]); setFileName(""); setProgress(null); setSourceClientId("");
    setImported([]); setCvStatuses({});
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
    const headers = ["name", "email", "phone", "role", "current_company", "location", "experience", "linkedin_url", "salary_min", "salary_max", "skills", "cv_filename"];
    const sample = ["Jane Doe", "jane@example.com", "+91 90000 00000", "Senior Engineer", "Acme", "Bengaluru", "7 years", "https://linkedin.com/in/jane", "35", "50", "React, Node, TypeScript", "jane_doe.pdf"];
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
    const importedRows: { id: string; name: string; cvFilename?: string }[] = [];
    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      try {
        const created = await addCandidate({ data: {
          name: r.name,
          email: r.email, phone: r.phone, role: r.role,
          location: r.location, experience: r.experience,
          current_company: r.current_company, linkedin_url: r.linkedin_url,
          salary: r.salary, skills: r.skills,
          salary_min: r.salary_min, salary_max: r.salary_max,
          source_client_id: sourceClientId || null,
        }});
        importedRows.push({ id: created.id, name: created.name, cvFilename: r.cv_filename });
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
    setImported(importedRows);
    toast.success(`Imported ${ok} · ${failed} failed`);
    // Keep dialog open so the user can attach CVs in step 2.
  }

  function normalizeFilename(s: string) {
    return s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function normalizeName(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function matchCandidateForFile(f: File): { id: string; name: string } | null {
    const fn = normalizeFilename(f.name);
    if (!fn) return null;
    // 1) exact cv_filename match (case-insensitive)
    for (const c of imported) {
      if (c.cvFilename && c.cvFilename.trim().toLowerCase() === f.name.trim().toLowerCase()) {
        return { id: c.id, name: c.name };
      }
    }
    // 2) normalized cv_filename equality
    for (const c of imported) {
      if (c.cvFilename && normalizeFilename(c.cvFilename) === fn) return { id: c.id, name: c.name };
    }
    // 3) filename contains normalized name (or vice versa) — must be unique to be trusted
    const candidates = imported.filter((c) => {
      const n = normalizeName(c.name);
      if (!n) return false;
      return fn.includes(n) || n.includes(fn);
    });
    if (candidates.length === 1) return { id: candidates[0].id, name: candidates[0].name };
    return null;
  }

  async function handleCvPicked(files: File[]) {
    if (!files.length) return;
    // Seed statuses
    setCvStatuses((prev) => {
      const next = { ...prev };
      for (const f of files) next[f.name] = { status: "queued" };
      return next;
    });
    for (const f of files) {
      const match = matchCandidateForFile(f);
      if (!match) {
        setCvStatuses((p) => ({ ...p, [f.name]: { status: "failed", error: "No match — rename file to match candidate name" } }));
        continue;
      }
      setCvStatuses((p) => ({ ...p, [f.name]: { status: "uploading", candidateName: match.name } }));
      try {
        const up = await uploadCvFile(f);
        const res = await attachCv({ data: {
          candidateId: match.id,
          storagePath: up.path,
          fileName: up.name,
          mime: up.mime,
          sizeBytes: up.size,
        }});
        setCvStatuses((p) => ({
          ...p,
          [f.name]: {
            status: res.status === "already_has_cv" ? "already" : "attached",
            candidateName: res.name,
          },
        }));
      } catch (e) {
        setCvStatuses((p) => ({ ...p, [f.name]: { status: "failed", candidateName: match.name, error: e instanceof Error ? e.message : "Failed" } }));
      }
    }
    qc.invalidateQueries({ queryKey: ["candidates"] });
  }

  async function manualAttach(fileName: string, candidateId: string, file: File) {
    const target = imported.find((c) => c.id === candidateId);
    setCvStatuses((p) => ({ ...p, [fileName]: { status: "uploading", candidateName: target?.name } }));
    try {
      const up = await uploadCvFile(file);
      const res = await attachCv({ data: {
        candidateId,
        storagePath: up.path,
        fileName: up.name,
        mime: up.mime,
        sizeBytes: up.size,
      }});
      setCvStatuses((p) => ({
        ...p,
        [fileName]: {
          status: res.status === "already_has_cv" ? "already" : "attached",
          candidateName: res.name,
        },
      }));
      qc.invalidateQueries({ queryKey: ["candidates"] });
    } catch (e) {
      setCvStatuses((p) => ({ ...p, [fileName]: { status: "failed", candidateName: target?.name, error: e instanceof Error ? e.message : "Failed" } }));
    }
  }

  const validCount = rows.filter((r) => !r._error).length;
  const errorCount = rows.length - validCount;
  const attachingBusy = Object.values(cvStatuses).some((s) => s.status === "uploading" || s.status === "queued");

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

          <div className="grid gap-1.5">
            <Label className="text-xs">Tag all rows with source client (optional)</Label>
            <select
              value={sourceClientId}
              onChange={(e) => setSourceClientId(e.target.value)}
              disabled={importing}
              className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 max-w-sm"
            >
              <option value="">— None —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">Useful when importing legacy candidates that came from a specific client.</p>
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

          {imported.length > 0 && (
            <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold inline-flex items-center gap-2">
                  <UploadCloud className="size-4 text-primary" /> Step 2 · Attach CVs (optional)
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Drop CV files below — each is matched to a candidate by the <code>cv_filename</code> column,
                  or by the candidate's name if the filename contains it. Unmatched files can be assigned manually.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (files.length) void handleCvPicked(files);
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => cvInputRef.current?.click()} className="gap-1.5" disabled={attachingBusy}>
                  <UploadCloud className="size-3.5" /> Choose CV files
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  {imported.length} candidate{imported.length === 1 ? "" : "s"} ready to receive a CV
                </span>
              </div>

              {Object.keys(cvStatuses).length > 0 && (
                <div className="rounded-md border border-border overflow-hidden max-h-[260px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">File</th>
                        <th className="text-left font-medium px-2 py-2">Candidate</th>
                        <th className="text-left font-medium px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Object.entries(cvStatuses).map(([fName, s]) => (
                        <tr key={fName}>
                          <td className="px-3 py-1.5 truncate max-w-[220px]" title={fName}>{fName}</td>
                          <td className="px-2 py-1.5">
                            {s.status === "failed" && !s.candidateName ? (
                              <ManualAttachSelect
                                imported={imported}
                                onPick={(id) => {
                                  // We no longer have the File object; user must reselect.
                                  const input = document.createElement("input");
                                  input.type = "file";
                                  input.accept = ".pdf,.doc,.docx,.txt";
                                  input.onchange = () => {
                                    const f = input.files?.[0];
                                    if (f) void manualAttach(fName, id, f);
                                  };
                                  input.click();
                                }}
                              />
                            ) : (
                              <span className="text-muted-foreground">{s.candidateName ?? "—"}</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {s.status === "queued" && <span className="text-muted-foreground">Queued</span>}
                            {s.status === "uploading" && (
                              <span className="inline-flex items-center gap-1 text-primary">
                                <Loader2 className="size-3 animate-spin" /> Attaching…
                              </span>
                            )}
                            {s.status === "attached" && (
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="size-3" /> Attached
                              </span>
                            )}
                            {s.status === "already" && (
                              <span className="text-amber-600">Already had a CV</span>
                            )}
                            {s.status === "failed" && (
                              <span className="text-destructive">{s.error ?? "Failed"}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing || attachingBusy}>
            {imported.length > 0 ? "Done" : "Cancel"}
          </Button>
          {imported.length === 0 && (
            <Button
              onClick={runImport}
              disabled={importing || parsing || validCount === 0}
              className="gap-2"
            >
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Import {validCount > 0 ? `${validCount} candidate${validCount === 1 ? "" : "s"}` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualAttachSelect({ imported, onPick }: { imported: { id: string; name: string }[]; onPick: (id: string) => void }) {
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        const v = e.target.value;
        e.currentTarget.value = "";
        if (v) onPick(v);
      }}
      className="h-7 rounded-md border border-input bg-card px-1.5 text-[11px]"
    >
      <option value="">Assign to…</option>
      {imported.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}