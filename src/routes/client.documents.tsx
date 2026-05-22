import { createFileRoute } from "@tanstack/react-router";
import { FileText, CheckCircle2, Clock, Loader2, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { ClientShell } from "@/components/client-shell";
import { listOwnClientDocuments, type DocumentRow } from "@/lib/documents.functions";
import { createSignedAttachmentUrl } from "@/lib/messages.functions";

export const Route = createFileRoute("/client/documents")({
  component: () => <ClientShell><Page /></ClientShell>,
});

function Page() {
  const listFn = useServerFn(listOwnClientDocuments);
  const signFn = useServerFn(createSignedAttachmentUrl);
  const q = useQuery({ queryKey: ["client-documents"], queryFn: () => listFn() });
  const docs = q.data ?? [];

  // Group by position (or "General" when no position)
  const groups = new Map<string, { title: string; docs: DocumentRow[] }>();
  for (const d of docs) {
    const key = d.position?.id ?? "general";
    const title = d.position?.title ?? "General documents";
    if (!groups.has(key)) groups.set(key, { title, docs: [] });
    groups.get(key)!.docs.push(d);
  }

  async function open(d: DocumentRow) {
    if (!d.storage_bucket || !d.storage_path) return;
    const { url } = await signFn({
      data: { bucket: d.storage_bucket, path: d.storage_path, expiresIn: 300 },
    });
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">Job descriptions, onboarding files, and offer letters shared with your account.</p>
      </div>

      {q.isLoading && (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="size-4 animate-spin" /> Loading documents…
        </div>
      )}

      {!q.isLoading && Array.from(groups.entries()).map(([key, group]) => {
        const received = group.docs.filter(d => d.received).length;
        return (
          <div key={key} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{group.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{group.docs.length} document{group.docs.length === 1 ? "" : "s"}</p>
              </div>
              <div className="text-sm font-medium tabular-nums">{received}/{group.docs.length} received</div>
            </div>
            <div className="divide-y divide-border">
              {group.docs.map(d => (
                <div key={d.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className={cn("size-8 rounded-full grid place-items-center", d.received ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                    {d.received ? <CheckCircle2 className="size-4" /> : <Clock className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{d.kind} · {d.required ? "Required" : "Optional"}</div>
                  </div>
                  {d.storage_path && (
                    <button onClick={() => open(d)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <Download className="size-3.5" /> Open
                    </button>
                  )}
                  <span className={cn("text-xs font-medium", d.received ? "text-success" : "text-warning")}>
                    {d.received ? "Received" : "Awaiting"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {!q.isLoading && groups.size === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <FileText className="size-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">No documents shared yet.</p>
        </div>
      )}
    </div>
  );
}