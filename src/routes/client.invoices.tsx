import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ReceiptText, Download } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { listOwnClientInvoices, fmtINR, fmtDate } from "@/lib/billing.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/invoices")({
  component: () => <ClientShell><Page /></ClientShell>,
});

const STATUS_TONE = {
  draft:     "bg-muted/40 text-muted-foreground border-border",
  sent:      "bg-info/15 text-info border-info/25",
  paid:      "bg-success/15 text-success border-success/25",
  overdue:   "bg-destructive/15 text-destructive border-destructive/25",
  cancelled: "bg-muted/40 text-muted-foreground border-border",
} as const;

function Page() {
  const fetchInvoices = useServerFn(listOwnClientInvoices);
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["client-invoices"],
    queryFn: () => fetchInvoices({ data: undefined }),
  });

  const totals = {
    outstanding: invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((a, b) => a + Number(b.total_inr || 0), 0),
    paid: invoices.filter((i) => i.status === "paid").reduce((a, b) => a + Number(b.total_inr || 0), 0),
    count: invoices.length,
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Billing</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <ReceiptText className="size-5 text-primary" /> Invoices
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? "\u00A0" : "All invoices issued to your account."}
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Total invoices" value={totals.count.toString()} />
        <Stat label="Outstanding" value={fmtINR(totals.outstanding)} />
        <Stat label="Paid to date" value={fmtINR(totals.paid)} />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {invoices.length === 0 && !isLoading && (
          <div className="p-12 text-center text-sm text-muted-foreground">No invoices yet.</div>
        )}
        {invoices.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Invoice #</th>
                <th className="text-left font-medium px-2 py-2.5">Period</th>
                <th className="text-left font-medium px-2 py-2.5">Issued</th>
                <th className="text-left font-medium px-2 py-2.5">Due</th>
                <th className="text-left font-medium px-2 py-2.5">Status</th>
                <th className="text-right font-medium px-4 py-2.5">Amount</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-secondary/30 transition">
                  <td className="px-4 py-3 font-medium">{inv.invoice_no}</td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">{fmtDate(inv.period_from)} → {fmtDate(inv.period_to)}</td>
                  <td className="px-2 py-3 text-xs">{fmtDate(inv.issue_date)}</td>
                  <td className="px-2 py-3 text-xs">{fmtDate(inv.due_date)}</td>
                  <td className="px-2 py-3">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize", STATUS_TONE[inv.status])}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtINR(Number(inv.total_inr || 0))}</td>
                  <td className="px-2 py-3 text-right">
                    <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" title="Download (coming soon)" disabled>
                      <Download className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
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