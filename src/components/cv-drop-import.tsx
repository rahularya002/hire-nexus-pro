import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud, Loader2, CheckCircle2, XCircle, FileText, AlertTriangle, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SalaryRange } from "@/components/ui/salary-range";
import { Badge } from "@/components/ui/badge";
import { uploadCvFile } from "@/lib/upload-cv";
import { extractCandidateFromCv, saveCandidateFromCv, discardCvUpload } from "@/lib/candidates.functions";

type RowStatus =
  | "queued"
  | "uploading"
  | "extracting"
  | "review"
  | "saving"
  | "created"
  | "duplicate"
  | "skipped"
  | "failed";

type ExtractedFields = {
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  current_company: string | null;
  experience: string | null;
  location: string | null;
  linkedin_url: string | null;
  salary: string | null;
  salary_min: number | null;
  salary_max: number | null;
  skills: string[];
  notes: string | null;
};

type Row = {
  id: string;
  fileName: string;
  status: RowStatus;
  name?: string;
  error?: string;
  partial?: boolean;
  upload?: { path: string; name: string; mime: string; size: number };
  fields?: ExtractedFields;
  duplicate?: { id: string; name: string } | null;
};

const ACCEPT = ".pdf,.doc,.docx,.txt";

function statusMeta(s: RowStatus) {
  switch (s) {
    case "queued":     return { label: "Queued",     icon: <FileText className="size-3.5 text-muted-foreground" /> };
    case "uploading":  return { label: "Uploading",  icon: <Loader2 className="size-3.5 animate-spin text-primary" /> };
    case "extracting": return { label: "Extracting", icon: <Loader2 className="size-3.5 animate-spin text-primary" /> };
    case "review":     return { label: "Review",     icon: <Pencil className="size-3.5 text-amber-500" /> };
    case "saving":     return { label: "Saving",     icon: <Loader2 className="size-3.5 animate-spin text-primary" /> };
    case "created":    return { label: "Saved",      icon: <CheckCircle2 className="size-3.5 text-emerald-500" /> };
    case "duplicate":  return { label: "Duplicate — skipped", icon: <AlertTriangle className="size-3.5 text-amber-500" /> };
    case "skipped":    return { label: "Skipped",    icon: <X className="size-3.5 text-muted-foreground" /> };
    case "failed":     return { label: "Failed",     icon: <XCircle className="size-3.5 text-destructive" /> };
  }
}

export type CvDropImportHandle = { openPicker: () => void };

export const CvDropImport = forwardRef<CvDropImportHandle, {
  children: React.ReactNode;
  sourceClientId?: string | null;
  className?: string;
}>(function CvDropImport({ children, sourceClientId, className }, ref) {
  const qc = useQueryClient();
  const extractFn = useServerFn(extractCandidateFromCv);
  const saveFn = useServerFn(saveCandidateFromCv);
  const discardFn = useServerFn(discardCvUpload);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const depthRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useImperativeHandle(ref, () => ({ openPicker: () => inputRef.current?.click() }), []);

  const running = rows.some((r) =>
    r.status === "uploading" || r.status === "extracting" || r.status === "queued" || r.status === "saving",
  );
  const pendingReview = useMemo(() => rows.filter((r) => r.status === "review"), [rows]);
  const activeRow = useMemo(() => rows.find((r) => r.id === activeReviewId) ?? null, [rows, activeReviewId]);

  const process = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const initial: Row[] = files.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      fileName: f.name,
      status: "queued",
    }));
    setRows((prev) => [...initial, ...prev]);
    setOpen(true);

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const id = initial[i].id;
      try {
        setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "uploading" } : r)));
        const up = await uploadCvFile(f);
        setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "extracting" } : r)));
        const res = await extractFn({
          data: {
            storagePath: up.path,
            fileName: up.name,
            mime: up.mime,
            sizeBytes: up.size,
          },
        });
        const fields: ExtractedFields = {
          name: res.fields.name ?? res.fallbackName,
          email: res.fields.email ?? null,
          phone: res.fields.phone ?? null,
          role: res.fields.role ?? null,
          current_company: res.fields.current_company ?? null,
          experience: res.fields.experience ?? null,
          location: res.fields.location ?? null,
          linkedin_url: res.fields.linkedin_url ?? null,
          salary: res.fields.salary ?? null,
          salary_min: res.fields.salary_min ?? null,
          salary_max: res.fields.salary_max ?? null,
          skills: Array.isArray(res.fields.skills) ? res.fields.skills : [],
          notes: res.fields.notes ?? null,
        };
        setRows((p) => p.map((r) =>
          r.id === id
            ? {
                ...r,
                status: "review",
                name: fields.name ?? r.fileName,
                upload: up,
                fields,
                partial: res.status === "partial",
                duplicate: res.duplicate ?? null,
              }
            : r,
        ));
      } catch (e) {
        setRows((p) => p.map((r) =>
          r.id === id ? { ...r, status: "failed", error: e instanceof Error ? e.message : "Failed" } : r,
        ));
      }
    }
  }, [extractFn]);

  const updateFields = useCallback((id: string, patch: Partial<ExtractedFields>) => {
    setRows((p) => p.map((r) => (r.id === id && r.fields ? { ...r, fields: { ...r.fields, ...patch } } : r)));
  }, []);

  const saveRow = useCallback(async (id: string): Promise<boolean> => {
    const row = rows.find((r) => r.id === id);
    if (!row || !row.upload || !row.fields) return false;
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "saving" } : r)));
    try {
      const res = await saveFn({
        data: {
          storagePath: row.upload.path,
          fileName: row.upload.name,
          mime: row.upload.mime,
          sizeBytes: row.upload.size,
          sourceClientId: sourceClientId ?? null,
          fields: row.fields,
        },
      });
      if (res.status === "duplicate") {
        setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "duplicate", name: res.name } : r)));
        toast.message(`Duplicate — matched existing candidate ${res.name}`);
      } else {
        setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "created", name: res.candidate.name } : r)));
        toast.success(`Saved: ${res.candidate.name}`);
      }
      qc.invalidateQueries({ queryKey: ["candidates"] });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "review", error: msg } : r)));
      toast.error(msg);
      return false;
    }
  }, [rows, saveFn, sourceClientId, qc]);

  const skipRow = useCallback(async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (row?.upload?.path) {
      try { await discardFn({ data: { storagePath: row.upload.path } }); } catch { /* ignore */ }
    }
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "skipped" } : r)));
  }, [rows, discardFn]);

  const saveAllPending = useCallback(async () => {
    const ids = rows.filter((r) => r.status === "review").map((r) => r.id);
    for (const id of ids) {
      // Re-check on each iteration in case state moves under us.
      // saveRow reads fresh state via the closure over rows; because we set state
      // in each call, we resolve fields from the latest snapshot before saving.
      // eslint-disable-next-line no-await-in-loop
      await saveRow(id);
    }
  }, [rows, saveRow]);

  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      depthRef.current += 1;
      setDragging(true);
    }
    function onDragLeave() {
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) setDragging(false);
    }
    function onDragOver(e: DragEvent) {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    }
    function onDrop(e: DragEvent) {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      depthRef.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        /\.(pdf|docx?|txt)$/i.test(f.name),
      );
      if (!files.length) {
        toast.error("Drop PDF, DOC, DOCX or TXT files.");
        return;
      }
      void process(files);
    }
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [process]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) void process(files);
  }

  return (
    <div className={className}>
      {children}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={onPick}
      />

      {dragging && (
        <div className="fixed inset-0 z-[80] pointer-events-none grid place-items-center bg-background/70 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary/60 bg-card px-10 py-12 text-center shadow-2xl">
            <UploadCloud className="size-10 mx-auto text-primary" />
            <div className="mt-3 text-lg font-semibold">Drop CVs to import</div>
            <div className="text-sm text-muted-foreground mt-1">
              We'll extract fields — you review before saving.
            </div>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!running) setOpen(v); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review CV imports</DialogTitle>
            <DialogDescription>
              Each file is parsed with AI. Review or edit the extracted details, then save.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto space-y-1.5 py-1">
            {rows.map((r) => {
              const m = statusMeta(r.status);
              const canReview = r.status === "review";
              return (
                <div key={r.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-2.5 py-2 text-sm">
                  <div className="shrink-0">{m.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.name ?? r.fileName}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {r.name ? r.fileName : null}
                      {r.duplicate ? <span className="text-amber-500"> — possible duplicate: {r.duplicate.name}</span> : null}
                      {r.partial ? <span className="text-amber-500"> — low-confidence extraction</span> : null}
                      {r.error ? <span className="text-destructive"> — {r.error}</span> : null}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">{m.label}</div>
                  {canReview && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 gap-1"
                        onClick={() => setActiveReviewId(r.id)}
                      >
                        <Pencil className="size-3.5" /> Review
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-muted-foreground"
                        onClick={() => void skipRow(r.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-1.5">
              <UploadCloud className="size-3.5" /> Add more
            </Button>
            <div className="flex items-center gap-2">
              {pendingReview.length > 0 && (
                <Button size="sm" onClick={() => void saveAllPending()} disabled={running} className="gap-1.5">
                  <CheckCircle2 className="size-3.5" /> Save all ({pendingReview.length})
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={running} className="gap-1.5">
                <X className="size-3.5" /> Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReviewDialog
        row={activeRow}
        onClose={() => setActiveReviewId(null)}
        onChange={(patch) => activeRow && updateFields(activeRow.id, patch)}
        onSave={async () => {
          if (!activeRow) return;
          const ok = await saveRow(activeRow.id);
          if (ok) setActiveReviewId(null);
        }}
        onSkip={async () => {
          if (!activeRow) return;
          await skipRow(activeRow.id);
          setActiveReviewId(null);
        }}
      />
    </div>
  );
});

function ReviewDialog({
  row,
  onClose,
  onChange,
  onSave,
  onSkip,
}: {
  row: Row | null;
  onClose: () => void;
  onChange: (patch: Partial<ExtractedFields>) => void;
  onSave: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
}) {
  const open = !!row && row.status === "review";
  const f = row?.fields;
  const [skillInput, setSkillInput] = useState("");
  useEffect(() => { setSkillInput(""); }, [row?.id]);

  function addSkill() {
    const s = skillInput.trim();
    if (!s || !f) return;
    if (f.skills.includes(s)) { setSkillInput(""); return; }
    onChange({ skills: [...f.skills, s].slice(0, 40) });
    setSkillInput("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review extracted candidate</DialogTitle>
          <DialogDescription className="truncate">
            {row?.fileName}
            {row?.duplicate ? (
              <span className="ml-2 text-amber-500">· Possible duplicate of {row.duplicate.name}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {f && (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Name</Label>
                <Input value={f.name ?? ""} onChange={(e) => onChange({ name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={f.email ?? ""} onChange={(e) => onChange({ email: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={f.phone ?? ""} onChange={(e) => onChange({ phone: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Location</Label>
                <Input value={f.location ?? ""} onChange={(e) => onChange({ location: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Salary range (LPA)</Label>
                <SalaryRange
                  value={{ min: f.salary_min, max: f.salary_max }}
                  onChange={(v) => onChange({ salary_min: v.min, salary_max: v.max })}
                />
              </div>
              <div className="col-span-2">
                <Label>Skills</Label>
                <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background px-2 py-2 min-h-9">
                  {f.skills.map((s) => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s}
                      <button
                        type="button"
                        onClick={() => onChange({ skills: f.skills.filter((x) => x !== s) })}
                        className="ml-0.5 text-muted-foreground hover:text-foreground"
                        aria-label={`Remove ${s}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    className="flex-1 min-w-[8ch] bg-transparent text-sm outline-none"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addSkill();
                      } else if (e.key === "Backspace" && !skillInput && f.skills.length) {
                        onChange({ skills: f.skills.slice(0, -1) });
                      }
                    }}
                    onBlur={addSkill}
                    placeholder="Add skill…"
                  />
                </div>
              </div>
            </div>

            <details className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-sm">
              <summary className="cursor-pointer text-muted-foreground">More fields (role, company, experience, LinkedIn, notes)</summary>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label>Role</Label>
                  <Input value={f.role ?? ""} onChange={(e) => onChange({ role: e.target.value })} />
                </div>
                <div>
                  <Label>Current company</Label>
                  <Input value={f.current_company ?? ""} onChange={(e) => onChange({ current_company: e.target.value })} />
                </div>
                <div>
                  <Label>Experience</Label>
                  <Input value={f.experience ?? ""} onChange={(e) => onChange({ experience: e.target.value })} placeholder="e.g. 5 years" />
                </div>
                <div>
                  <Label>LinkedIn</Label>
                  <Input value={f.linkedin_url ?? ""} onChange={(e) => onChange({ linkedin_url: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Textarea rows={3} value={f.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value })} />
                </div>
              </div>
            </details>
          </div>
        )}
        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => void onSkip()} className="gap-1.5 text-muted-foreground">
            <Trash2 className="size-3.5" /> Skip
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => void onSave()} className="gap-1.5">
              <CheckCircle2 className="size-3.5" /> Save candidate
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}