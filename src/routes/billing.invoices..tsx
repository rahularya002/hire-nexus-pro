import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, CheckCircle2, ReceiptText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getInvoice, setInvoiceStatus, fmtINR, fmtDate, type InvoiceStatus } from "@/lib/billing.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/billing/invoices/")({
  component: () => <AppShell><Page /></AppShell>,
});

const STATUS_TONE: Record<InvoiceStatus, string> = {
  draft: "bg-muted/40 text-muted-foreground border-border",
  sent: "bg-info/15 text-info border-info/25",
  paid: "bg-success/15 text-success border-success/25",
  overdue: "bg-destructive/15 text-destructive border-destructive/25",
  cancelled: "bg-muted/40 text-muted-foreground border-border",
};

function Page() {
  const { invoiceId } = Route.useParams();
  const qc = useQueryClient();
  const fn = useServerFn(getInvoice);
  const updFn = useServerFn(setInvoiceStatus);
  const q = useQuery({ queryKey: ["billing", "invoice", invoiceId], queryFn: () => fn({ data: { invoiceId } }) });
  const mut = useMutation({
    mutationFn: (status: InvoiceStatus) => updFn({ data: { invoiceId, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing"] }),
  });

  if (q.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (q.data === null) throw notFound();
  const { invoice: inv, items, terms, clientName } = q.data!;

  return (
    <div className="space-y-6">
      <Link to="/billing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Billing overview
      </Link>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5"><ReceiptText className="size-3.5" /> Invoice</div>
            <h1 className="text-2xl font-semibold tracking-tight">{inv.invoice_no}</h1>
            <div className="text-sm text-muted-foreground mt-1">
              <Link to="/billing/clients/$clientId" params={{ clientId: inv.client_id }} className="hover:text-foreground">{clientName}</Link>
              {" · "}{fmtDate(inv.period_from)} → {fmtDate(inv.period_to)}
              {inv.po_number && <> · PO {inv.po_number}</>}
            </div>
          </div>
          <div className="text-right">
            <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize", STATUS_TONE[inv.status])}>{inv.status}</span>
            <div className="text-3xl font-semibold tabular-nums mt-2">{fmtINR(Number(inv.total_inr))}</div>
            <div className="text-[11px] text-muted-foreground">issued {fmtDate(inv.issue_date)} · due {fmtDate(inv.due_date)}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          {inv.status === "draft" && <Action onClick={() => mut.mutate("sent")} icon={<Send className="size-3.5" />}>Mark sent</Action>}
          {(inv.status === "sent" || inv.status === "overdue") && <Action onClick={() => mut.mutate("paid")} icon={<CheckCircle2 className="size-3.5" />}>Mark paid</Action>}
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2.5">Line items</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Candidate</th>
                <th className="text-left font-medium px-2 py-2.5">Position</th>
                <th className="text-left font-medium px-2 py-2.5">Joining</th>
                <th className="text-left font-medium px-2 py-2.5">CTC</th>
                <th className="text-left font-medium px-2 py-2.5">Fee basis</th>
                <th className="text-right font-medium px-4 py-2.5">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground text-sm">No line items.</td></tr>}
              {items.map((li) => (
                <tr key={li.id}>
                  <td className="px-4 py-3 font-medium">{li.candidate_name}</td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">{li.position_title}</td>
                  <td className="px-2 py-3 text-xs">{fmtDate(li.joining_date)}</td>
                  <td className="px-2 py-3 text-xs tabular-nums">{fmtINR(Number(li.ctc_inr ?? 0))}</td>
                  <td className="px-2 py-3 text-xs">{li.fee_basis}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtINR(Number(li.amount_inr))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Total label="Subtotal" value={fmtINR(Number(inv.subtotal_inr))} />
        <Total label={`GST ${terms.gst_pct}%`} value={fmtINR(Number(inv.gst_inr))} />
        <Total label={`TDS ${terms.tds_pct}%`} value={`-${fmtINR(Number(inv.tds_inr))}`} tone="muted" />
        <Total label="Net payable" value={fmtINR(Number(inv.total_inr))} tone="primary" />
      </section>
    </div>
  );
}

function Action({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background hover:bg-secondary text-xs font-medium transition">
      {icon}{children}
    </button>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone?: "muted" | "primary" }) {
  return (
    <div className={cn("rounded-xl border p-4", tone === "primary" ? "border-primary/30 bg-primary/5" : "border-border bg-card")}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-semibold tabular-nums mt-1", tone === "muted" && "text-muted-foreground", tone === "primary" && "text-primary")}>{value}</div>
    </div>
  );
}
