import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  enrichArchivePerson,
  getArchiveResumeUrl,
  getEmailCandidate,
  promoteArchivePerson,
  setArchiveReviewStatus,
  type ArchivePerson,
} from "@/lib/email-import.functions";
import { KIND_LABEL, OutcomeBadge, fmtDate, txt } from "./shared";

export function PersonSheet({ person, onClose }: { person: ArchivePerson | null; onClose: () => void }) {
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getEmailCandidate);
  const resumeUrl = useServerFn(getArchiveResumeUrl);
  const promote = useServerFn(promoteArchivePerson);
  const setStatus = useServerFn(setArchiveReviewStatus);
  const enrich = useServerFn(enrichArchivePerson);

  const detail = useQuery({
    queryKey: ["email-archive-person", person?.id],
    queryFn: () => fetchDetail({ data: { id: person!.id } }),
    enabled: !!person,
  });

  const promoteMut = useMutation({
    mutationFn: () => promote({ data: { id: person!.id } }),
    onSuccess: (r) => {
      toast.success(r.alreadyPromoted ? "Already in your candidate database." : "Added to candidate database.");
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
      qc.invalidateQueries({ queryKey: ["email-archive-person", person?.id] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add candidate"),
  });

  const restoreMut = useMutation({
    mutationFn: () => setStatus({ data: { id: person!.id, reviewStatus: "imported" } }),
    onSuccess: () => {
      toast.success("Restored to the archive.");
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
      qc.invalidateQueries({ queryKey: ["email-archive-person", person?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not restore this person"),
  });

  const enrichMut = useMutation({
    mutationFn: (force: boolean) => enrich({ data: { id: person!.id, force } }),
    onSuccess: (r) => {
      toast.success(r.cached ? "Showing the saved summary." : "Summary ready.");
      qc.invalidateQueries({ queryKey: ["email-archive-person", person?.id] });
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not generate a summary"),
  });

  const openResume = async (id: string) => {
    const { url } = await resumeUrl({ data: { resumeId: id } });
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Resume file unavailable");
  };

  const p = detail.data?.person ?? person;

  return (
    <Sheet open={!!person} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{p?.name}</SheetTitle>
          <SheetDescription>
            {txt(p?.email) ?? "No email"} {txt(p?.phone) ? `· ${txt(p?.phone)}` : ""}
          </SheetDescription>
        </SheetHeader>

        {p && (
          <div className="mt-5 space-y-6 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <OutcomeBadge
                artifact={p.artifact_type}
                score={p.confidence}
                state={
                  p.review_status === "needs_review"
                    ? "needs_review"
                    : p.review_status === "rejected"
                      ? "skipped"
                      : "imported"
                }
              />
              <span className="text-[11px] text-muted-foreground">
                {KIND_LABEL[p.email_kind ?? "other"] ?? "Other"}
              </span>
            </div>
            {txt(p.classification_reason) && (
              <p className="text-[11px] text-muted-foreground -mt-4">{txt(p.classification_reason)}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {p.review_status !== "imported" && (
                <Button variant="outline" onClick={() => restoreMut.mutate()} disabled={restoreMut.isPending}>
                  <CheckCircle2 className="size-4" /> Restore to archive
                </Button>
              )}
              <Button
                onClick={() => promoteMut.mutate()}
                disabled={promoteMut.isPending || !!p.promoted_candidate_id}
              >
                {promoteMut.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <UserPlus className="size-3.5" />
                )}
                {p.promoted_candidate_id ? "In candidate database" : "Add to candidate database"}
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">AI summary</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => enrichMut.mutate(!!p.ai_summary)}
                  disabled={enrichMut.isPending}
                >
                  {enrichMut.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {p.ai_summary ? "Regenerate" : "Generate"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                {txt(p.ai_summary) ??
                  "No summary yet. Summaries are only written when you ask, so importing stays fast."}
              </p>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Relationship
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                First contact {fmtDate(p.first_email_at)} · last contact {fmtDate(p.last_email_at)} ·{" "}
                {p.email_count} email{p.email_count === 1 ? "" : "s"} · {p.resume_count} resume version
                {p.resume_count === 1 ? "" : "s"}
              </div>
              {txt(p.notes) && <p className="text-xs">{txt(p.notes)}</p>}
              {p.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {p.skills.map((s) => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Resume versions
              </div>
              {(detail.data?.resumes ?? []).length === 0 ? (
                <div className="text-xs text-muted-foreground">No resume files stored for this person.</div>
              ) : (
                (detail.data?.resumes ?? []).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => openResume(r.id)}
                    className="w-full text-left rounded-xl border border-border p-3 hover:border-primary/50 flex items-center gap-2"
                  >
                    <FileText className="size-4 text-primary shrink-0" />
                    <span className="text-xs truncate flex-1">{r.file_name}</span>
                    <span className="text-[11px] text-muted-foreground">{fmtDate(r.received_at)}</span>
                  </button>
                ))
              )}
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Email timeline
              </div>
              {(detail.data?.messages ?? []).length === 0 && !detail.isLoading && (
                <div className="text-xs text-muted-foreground">No emails stored yet.</div>
              )}
              {(detail.data?.messages ?? []).map((m) => (
                <div key={m.id} className="rounded-xl border border-border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    {m.direction === "outbound" ? (
                      <ArrowUpRight className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ArrowDownLeft className="size-3.5 text-primary" />
                    )}
                    <span className="text-xs font-medium truncate flex-1">{m.subject ?? "(no subject)"}</span>
                    <span className="text-[11px] text-muted-foreground">{fmtDate(m.sent_at)}</span>
                  </div>
                  {m.snippet && <p className="text-[11px] text-muted-foreground line-clamp-2">{m.snippet}</p>}
                </div>
              ))}
              {detail.isLoading && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" /> Loading history…
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}