import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Calendar, IndianRupee, Shield } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { listPlacements } from "@/lib/interviews.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/placements")({
  component: () => <ClientShell><Page /></ClientShell>,
});

const INVOICE_TONE = {
  draft: "bg-warning/15 text-warning border-warning/25",
  sent:  "bg-info/15 text-info border-info/25",
  paid:  "bg-success/15 text-success border-success/25",
  overdue: "bg-destructive/15 text-destructive border-destructive/25",
} as const;

function Page() {
  const fetchPlacements = useServerFn(listPlacements);
  const { data: placements = [], isLoading } = useQuery({
    queryKey: ["client-placements"],
    queryFn: () => fetchPlacements({ data: {} }),
  });

  const inWindowOf = (p: typeof placements[number]) => {
    if (!p.joining_date) return { remaining: 0, days: 0 };
    const joined = new Date(p.joining_date).getTime();
    const days = Math.max(0, Math.floor((Date.now() - joined) / 86_400_000));
    return { remaining: Math.max(0, p.guarantee_window_days - days), days };
  };

  const stats = {
    total: placements.length,
    inWindow: placements.filter((p) => inWindowOf(p).remaining > 0).length,
    paid: placements.filter((p) => p.invoice_status === "paid").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Hiring history</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <CheckCircle2 className="size-5 text-success" /> Placements
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? "\u00A0" : "Joined candidates with replacement guarantee status."}
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Total placements" value={stats.total.toString()} />
        <Stat label="In guarantee window" value={stats.inWindow.toString()} />
        <Stat label="Invoices paid" value={`${stats.paid}/${stats.total}`} />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {placements.length === 0 && !isLoading && (
          <div className="p-12 text-center text-sm text-muted-foreground">No placements yet.</div>
        )}
        {placements.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Candidate</th>
              <th className="text-left font-medium px-2 py-2.5">Position</th>
              <th className="text-left font-medium px-2 py-2.5">CTC</th>
              <th className="text-left font-medium px-2 py-2.5">Offer / Joining</th>
              <th className="text-left font-medium px-2 py-2.5">Guarantee</th>
              <th className="text-right font-medium px-4 py-2.5">Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {placements.map((p) => {
              const { remaining, days } = inWindowOf(p);
              const inWindow = remaining > 0;
              const ctc = p.ctc_display || (p.ctc_inr ? `₹${p.ctc_inr.toLocaleString("en-IN")}` : "—");
              const initials = (p.candidate?.name ?? "?").split(/\s+/).map((s) => s[0]).join("").slice(0,2).toUpperCase();
              return (
                <tr key={p.id} className="hover:bg-secondary/30 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-gradient-to-br from-success/40 to-primary/40 grid place-items-center text-[11px] font-semibold">
                        {initials}
                      </div>
                      <div className="font-medium">{p.candidate?.name ?? "Unknown"}</div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-xs">
                    <Link to="/client/positions/$positionId" params={{ positionId: p.position_id }} className="hover:text-primary">
                      {p.position?.title ?? "—"}
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-xs inline-flex items-center gap-1"><IndianRupee className="size-3 text-muted-foreground" />{ctc.replace("₹", "")}</td>
                  <td className="px-2 py-3 text-xs">
                    <div className="inline-flex items-center gap-1"><Calendar className="size-3 text-muted-foreground" />{p.offer_date ?? "—"}</div>
                    <div className="text-muted-foreground">Joined {p.joining_date ?? "—"}</div>
                  </td>
                  <td className="px-2 py-3 text-xs">
                    <div className="inline-flex items-center gap-1.5">
                      <Shield className={cn("size-3.5", inWindow ? "text-success" : "text-muted-foreground")} />
                      <span className={cn("font-medium", inWindow ? "text-foreground" : "text-muted-foreground")}>
                        {inWindow ? `${remaining}d left` : "Cleared"}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{days}/{p.guarantee_window_days} days</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize", INVOICE_TONE[p.invoice_status])}>
                      {p.invoice_status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}