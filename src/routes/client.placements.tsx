import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Calendar, IndianRupee, Shield } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { placements } from "@/lib/client-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/placements")({
  component: () => <ClientShell><Page /></ClientShell>,
});

const INVOICE_TONE = {
  draft: "bg-warning/15 text-warning border-warning/25",
  sent:  "bg-info/15 text-info border-info/25",
  paid:  "bg-success/15 text-success border-success/25",
} as const;

function Page() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Hiring history</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <CheckCircle2 className="size-5 text-success" /> Placements
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Joined candidates with replacement guarantee status.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Total placements" value={placements.length.toString()} />
        <Stat label="In guarantee window" value={placements.filter(p => p.guaranteeDays < p.guaranteeWindow).length.toString()} />
        <Stat label="Invoices paid" value={`${placements.filter(p => p.invoiceStatus === "paid").length}/${placements.length}`} />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
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
              const remaining = p.guaranteeWindow - p.guaranteeDays;
              const inWindow = remaining > 0;
              return (
                <tr key={p.id} className="hover:bg-secondary/30 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-gradient-to-br from-success/40 to-primary/40 grid place-items-center text-[11px] font-semibold">
                        {p.initials}
                      </div>
                      <div className="font-medium">{p.candidateName}</div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-xs">
                    <Link to="/client/positions/$positionId" params={{ positionId: p.positionId }} className="hover:text-primary">
                      {p.positionTitle}
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-xs inline-flex items-center gap-1"><IndianRupee className="size-3 text-muted-foreground" />{p.ctc.replace("₹", "")}</td>
                  <td className="px-2 py-3 text-xs">
                    <div className="inline-flex items-center gap-1"><Calendar className="size-3 text-muted-foreground" />{p.offerDate}</div>
                    <div className="text-muted-foreground">Joined {p.joiningDate}</div>
                  </td>
                  <td className="px-2 py-3 text-xs">
                    <div className="inline-flex items-center gap-1.5">
                      <Shield className={cn("size-3.5", inWindow ? "text-success" : "text-muted-foreground")} />
                      <span className={cn("font-medium", inWindow ? "text-foreground" : "text-muted-foreground")}>
                        {inWindow ? `${remaining}d left` : "Cleared"}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{p.guaranteeDays}/{p.guaranteeWindow} days</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize", INVOICE_TONE[p.invoiceStatus])}>
                      {p.invoiceStatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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