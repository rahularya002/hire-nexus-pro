import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, X, Plus, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCandidate, getResumeSignedUrl, type CandidateRow } from "@/lib/candidates.functions";
import { createDocument } from "@/lib/documents.functions";
import { uploadCvFile } from "@/lib/upload-cv";
import { listClients, type ClientRow } from "@/lib/clients.functions";
import { useQuery } from "@tanstack/react-query";

export function EditCandidateDialog({
  open,
  onOpenChange,
  candidate,
  invalidateKeys = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidate: CandidateRow;
  invalidateKeys?: ReadonlyArray<ReadonlyArray<unknown>>;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateCandidate);
  const signFn = useServerFn(getResumeSignedUrl);
  const createDocFn = useServerFn(createDocument);
  const fetchClients = useServerFn(listClients);
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });

  const [name, setName] = useState(candidate.name);
  const [role, setRole] = useState(candidate.role ?? "");
  const [currentCompany, setCurrentCompany] = useState(candidate.current_company ?? "");
  const [experience, setExperience] = useState(candidate.experience ?? "");
  const [location, setLocation] = useState(candidate.location ?? "");
  const [email, setEmail] = useState(candidate.email ?? "");
  const [phone, setPhone] = useState(candidate.phone ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(candidate.linkedin_url ?? "");
  const [salary, setSalary] = useState(candidate.salary ?? "");
  const [salaryMin, setSalaryMin] = useState<string>(candidate.salary_min != null ? String(candidate.salary_min) : "");
  const [salaryMax, setSalaryMax] = useState<string>(candidate.salary_max != null ? String(candidate.salary_max) : "");
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const [sourceClientId, setSourceClientId] = useState<string>(candidate.source_client_id ?? "");
  const [skills, setSkills] = useState<string[]>(candidate.skills ?? []);
  const [skillInput, setSkillInput] = useState("");
  const [resumePath, setResumePath] = useState<string | null>(candidate.resume_url);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [openingCv, setOpeningCv] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(candidate.name);
    setRole(candidate.role ?? "");
    setCurrentCompany(candidate.current_company ?? "");
    setExperience(candidate.experience ?? "");
    setLocation(candidate.location ?? "");
    setEmail(candidate.email ?? "");
    setPhone(candidate.phone ?? "");
    setLinkedinUrl(candidate.linkedin_url ?? "");
    setSalary(candidate.salary ?? "");
    setSalaryMin(candidate.salary_min != null ? String(candidate.salary_min) : "");
    setSalaryMax(candidate.salary_max != null ? String(candidate.salary_max) : "");
    setNotes(candidate.notes ?? "");
    setSourceClientId(candidate.source_client_id ?? "");
    setSkills(candidate.skills ?? []);
    setSkillInput("");
    setResumePath(candidate.resume_url);
  }, [open, candidate]);

  const m = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id: candidate.id,
          name: name.trim(),
          role: role.trim() || null,
          current_company: currentCompany.trim() || null,
          experience: experience.trim() || null,
          location: location.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          salary: salary.trim() || null,
          salary_min: salaryMin.trim() === "" ? null : Number(salaryMin),
          salary_max: salaryMax.trim() === "" ? null : Number(salaryMax),
          notes: notes.trim() || null,
          source_client_id: sourceClientId || null,
          skills: skills.map((s) => s.trim()).filter(Boolean).slice(0, 40),
          resume_url: resumePath,
        },
      }),
    onSuccess: () => {
      toast.success("Candidate updated");
      qc.invalidateQueries({ queryKey: ["client-position-apps"] });
      qc.invalidateQueries({ queryKey: ["client-applications-all"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: [...key] });
      onOpenChange(false);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Could not update candidate"),
  });

  async function handleCvFile(f: File | null) {
    if (!f) return;
    setUploadingCv(true);
    try {
      const up = await uploadCvFile(f);
      setResumePath(up.path);
      try {
        await createDocFn({ data: {
          name: up.name, kind: "resume", candidate_id: candidate.id,
          storage_bucket: "documents", storage_path: up.path,
          mime: up.mime, size_bytes: up.size,
        }});
      } catch { /* non-fatal */ }
      toast.success("CV attached — save to apply");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingCv(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function openCv() {
    setOpeningCv(true);
    try {
      const { url } = await signFn({ data: { candidateId: candidate.id } });
      if (!url) throw new Error("No CV on file");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open CV");
    } finally {
      setOpeningCv(false);
    }
  }

  function addSkill() {
    const v = skillInput.trim();
    if (!v) return;
    if (skills.includes(v)) { setSkillInput(""); return; }
    setSkills([...skills, v].slice(0, 40));
    setSkillInput("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit candidate</DialogTitle>
          <DialogDescription>Update what we know about this candidate after speaking with them.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ec-name">Full name</Label>
              <Input id="ec-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-role">Current role</Label>
              <Input id="ec-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior ML Engineer" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-org">Current company</Label>
              <Input id="ec-org" value={currentCompany} onChange={(e) => setCurrentCompany(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-exp">Experience</Label>
              <Input id="ec-exp" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="6 yrs" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-loc">Location</Label>
              <Input id="ec-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-email">Email</Label>
              <Input id="ec-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-phone">Phone</Label>
              <Input id="ec-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-li">LinkedIn URL</Label>
              <Input id="ec-li" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-salary">Salary / CTC</Label>
              <Input id="ec-salary" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="₹50 LPA" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-salary-min">Salary min (LPA)</Label>
              <NumberInput id="ec-salary-min" min={0} value={salaryMin} onChange={setSalaryMin} placeholder="12" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-salary-max">Salary max (LPA)</Label>
              <NumberInput id="ec-salary-max" min={0} value={salaryMax} onChange={setSalaryMax} placeholder="18" />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="ec-source-client">Source client</Label>
              <select
                id="ec-source-client"
                value={sourceClientId}
                onChange={(e) => setSourceClientId(e.target.value)}
                className="h-10 rounded-md border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="">— None —</option>
                {clients.map((c: ClientRow) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Skills</Label>
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
              <div className="flex flex-wrap gap-1.5 mt-1">
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
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ec-notes">Notes</Label>
            <Textarea id="ec-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth recording from your conversation…" />
          </div>

          <div className="grid gap-1.5">
            <Label>CV / Resume</Label>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
              onChange={(e) => handleCvFile(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-2 flex-wrap">
              {resumePath && candidate.resume_url === resumePath && (
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openCv} disabled={openingCv}>
                  {openingCv ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
                  Open current CV
                </Button>
              )}
              <Button type="button" variant={resumePath ? "ghost" : "outline"} size="sm" className="gap-1.5"
                onClick={() => fileRef.current?.click()} disabled={uploadingCv}>
                {uploadingCv ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                {resumePath ? "Replace CV" : "Upload CV"}
              </Button>
              {resumePath && (
                <span className="text-[11px] text-muted-foreground">
                  {resumePath === candidate.resume_url ? "CV on file" : "New CV attached — save to apply"}
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={m.isPending}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !name.trim()}>
            {m.isPending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}