import { createFileRoute } from "@tanstack/react-router";
import { FileText, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientShell } from "@/components/client-shell";
import { clientPositions } from "@/lib/client-data";

export const Route = createFileRoute("/client/documents")({
  component: () => <ClientShell><Page /></ClientShell>,
});

function Page() {
  const positions = clientPositions.filter(p => p.documents?.length);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">Onboarding documents for selected candidates</p>
      </div>

      {positions.map(p => {
        const docs = p.documents!;
        const received = docs.filter(d => d.received).length;
        return (
          <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Arjun Malhotra · Selected</p>
              </div>
              <div className="text-sm font-medium tabular-nums">{received}/{docs.length} received</div>
            </div>
            <div className="divide-y divide-border">
              {docs.map(d => (
                <div key={d.name} className="flex items-center gap-4 px-5 py-3.5">
                  <div className={cn("size-8 rounded-full grid place-items-center", d.received ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                    {d.received ? <CheckCircle2 className="size-4" /> : <Clock className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.required ? "Required" : "Optional"}</div>
                  </div>
                  <span className={cn("text-xs font-medium", d.received ? "text-success" : "text-warning")}>
                    {d.received ? "Received" : "Awaiting"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {positions.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <FileText className="size-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">No active document collections.</p>
        </div>
      )}
    </div>
  );
}