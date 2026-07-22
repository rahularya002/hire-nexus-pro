import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud, Loader2, CheckCircle2, XCircle, FileText, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { uploadCvFile } from "@/lib/upload-cv";
import { importCandidateFromCv } from "@/lib/candidates.functions";

type RowStatus = "queued" | "uploading" | "extracting" | "created" | "partial" | "duplicate" | "failed";
type Row = {
  id: string;
  fileName: string;
  status: RowStatus;
  name?: string;
  error?: string;
};

const ACCEPT = ".pdf,.doc,.docx,.txt";

function statusMeta(s: RowStatus) {
  switch (s) {
    case "queued":     return { label: "Queued",     icon: <FileText className="size-3.5 text-muted-foreground" /> };
    case "uploading":  return { label: "Uploading",  icon: <Loader2 className="size-3.5 animate-spin text-primary" /> };
    case "extracting": return { label: "Extracting", icon: <Loader2 className="size-3.5 animate-spin text-primary" /> };
    case "created":    return { label: "Saved",      icon: <CheckCircle2 className="size-3.5 text-emerald-500" /> };
    case "partial":    return { label: "Saved (partial)", icon: <AlertTriangle className="size-3.5 text-amber-500" /> };
    case "duplicate":  return { label: "Duplicate — skipped", icon: <AlertTriangle className="size-3.5 text-amber-500" /> };
    case "failed":     return { label: "Failed",     icon: <XCircle className="size-3.5 text-destructive" /> };
  }
}

export function CvDropImport({
  children,
  sourceClientId,
  className,
}: {
  children: React.ReactNode;
  sourceClientId?: string | null;
  className?: string;
}) {
  const qc = useQueryClient();
  const importFn = useServerFn(importCandidateFromCv);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const depthRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const running = rows.some((r) => r.status === "uploading" || r.status === "extracting" || r.status === "queued");

  const process = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const initial: Row[] = files.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      fileName: f.name,
      status: "queued",
    }));
    setRows((prev) => [...initial, ...prev]);
    setOpen(true);

    // Sequential to avoid rate-limits on the AI gateway.
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const id = initial[i].id;
      try {
        setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "uploading" } : r)));
        const up = await uploadCvFile(f);
        setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "extracting" } : r)));
        const res = await importFn({
          data: {
            storagePath: up.path,
            fileName: up.name,
            mime: up.mime,
            sizeBytes: up.size,
            sourceClientId: sourceClientId ?? null,
          },
        });
        if (res.status === "duplicate") {
          setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "duplicate", name: res.name } : r)));
        } else {
          setRows((p) => p.map((r) =>
            r.id === id
              ? { ...r, status: res.status === "partial" ? "partial" : "created", name: res.candidate.name }
              : r,
          ));
        }
      } catch (e) {
        setRows((p) => p.map((r) =>
          r.id === id ? { ...r, status: "failed", error: e instanceof Error ? e.message : "Failed" } : r,
        ));
      }
    }

    qc.invalidateQueries({ queryKey: ["candidates"] });
    const created = rows.filter((r) => r.status === "created" || r.status === "partial").length;
    if (created > 0) toast.success(`Imported ${created} candidate${created === 1 ? "" : "s"}`);
  }, [importFn, qc, sourceClientId, rows]);

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
              We'll extract name, contact, skills and experience automatically.
            </div>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!running) setOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importing CVs</DialogTitle>
            <DialogDescription>
              Each file is uploaded, parsed, and turned into a candidate.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-1.5 py-1">
            {rows.map((r) => {
              const m = statusMeta(r.status);
              return (
                <div key={r.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-2.5 py-2 text-sm">
                  <div className="shrink-0">{m.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.name ?? r.fileName}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {r.name ? r.fileName : null}
                      {r.error ? <span className="text-destructive"> — {r.error}</span> : null}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">{m.label}</div>
                </div>
              );
            })}
          </div>
          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-1.5">
              <UploadCloud className="size-3.5" /> Add more
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={running} className="gap-1.5">
              <X className="size-3.5" /> Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Standalone button that opens the file picker for CV drop import. Uses the same underlying flow via a ref. */
export function CvUploadButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="gap-2">
      <UploadCloud className="size-4" /> Upload CVs
    </Button>
  );
}