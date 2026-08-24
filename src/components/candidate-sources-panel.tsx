// Provenance for a candidate: the mailbox emails, threads and stored resumes
// that produced them. Links are minted on demand and expire — no storage paths
// or tokens are ever rendered.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Mail, Loader2, ExternalLink, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listCandidateSources, getCandidateSourceUrl, type CandidateSource } from "@/lib/candidates.functions";

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function CandidateSourcesPanel({ candidateId }: { candidateId: string }) {
  const fetchSources = useServerFn(listCandidateSources);
  const signFn = useServerFn(getCandidateSourceUrl);
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["candidate-sources", candidateId],
    queryFn: () => fetchSources({ data: { candidateId } }),
  });

  async function openFile(path: string) {
    setOpeningPath(path);
    try {
      const { url } = await signFn({ data: { candidateId, storagePath: path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open file");
    } finally {
      setOpeningPath(null);
    }
  }

  if (isLoading) {
    return <div className="text-xs text-muted-foreground py-6">Loading sources…</div>;
  }
  if (isError) {
    return <div className="text-xs text-destructive py-6">Could not load sources for this candidate.</div>;
  }

  const sources = (data?.sources ?? []) as CandidateSource[];
  if (!sources.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <Inbox className="size-6 text-muted-foreground mx-auto mb-2" />
        <div className="text-xs text-muted-foreground">
          No mailbox source on record — this candidate was added manually or imported from a CV.
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {sources.map((s, i) => (
        <li key={`${s.kind}-${s.storagePath ?? s.gmailThreadId ?? i}`} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {s.kind === "attachment" ? (
                <FileText className="size-3.5 text-primary shrink-0" />
              ) : (
                <Mail className="size-3.5 text-info shrink-0" />
              )}
              <span className="text-sm font-medium truncate">
                {s.kind === "attachment" ? (s.fileName ?? "Resume") : (s.subject ?? "Email")}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">{fmt(s.date)}</span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {s.fromEmail ?? "Unknown sender"}
            {s.kind === "attachment" && s.subject ? ` · ${s.subject}` : ""}
          </div>
          {s.excerpt && <div className="text-[11px] text-muted-foreground line-clamp-2">{s.excerpt}</div>}
          <div className="flex items-center gap-2 pt-0.5">
            {s.storagePath && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                disabled={openingPath === s.storagePath}
                onClick={() => openFile(s.storagePath!)}
              >
                {openingPath === s.storagePath ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" />}
                View resume
              </Button>
            )}
            {s.gmailThreadId && (
              <a
                href={`https://mail.google.com/mail/u/0/#all/${s.gmailThreadId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3" /> Open email
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
