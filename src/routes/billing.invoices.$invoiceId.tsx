import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { ArrowLeft, Download, Send, CheckCircle2, Bell, ShieldCheck, ReceiptText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  getInvoice, setInvoiceStatus, fmtINR, fmtDate, getTerms,
  clientName, clientInitials, clientColor,
  subscribeBilling, getBillingVersion,
} from "@/lib/billing-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/billing/invoices/$invoiceId")({
  component: () => <AppShell><Page /></AppShell>,
});

const STATUS_TONE = {
  draft:     "bg-muted/40 text-muted-foreground border-border",
  sent:      "bg-info/15 text-info border-info/25",
  paid:      "bg-success/15 text-success border-success/25",
  overdue:   "bg-destructive/15 text-destructive border-destructive/25",
  cancelled: "bg-muted/40 text-muted-foreground border-border",
} as const;

const KIND_TONE = {
  placement:               "bg-success/15 text-success border-success/25",
  replacement_covered:     "bg-info/15 text-info border-info/25",
  credit_left_in_window:   "bg-warning/15 text-warning border-warning/25",
} as const;

const KIND_LABEL = {
  placement: "Placed",
  replacement_covered: "Replacement (covered)",
  credit_left_in_window: "Credit · left in window",
} as const;

function Page() {
  useSyncExternalStore(subscribeBilling, getBillingVersion, getBillingVersion);
  const { invoiceId } = Route.useParams();
  const inv = getInvoice(invoiceId);
  if (!inv) throw notFound();
  const terms = getTerms(inv.clientId)!;

  return (
    <div className="space-y-6">
      <Link to="/billing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Billing overview
      </Link>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="size-14 rounded-xl grid place-items-center text-lg font-bold text-primary-foreground" style={{ background: clientColor(inv.clientId) }}>
            {clientInitials(inv.clientId)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5"><ReceiptText className="size-3.5" /> Invoice</div>
            <h1 className="text-2xl font-semibold tracking-tight">{inv.invoiceNo}</h1>
            <div className="text-sm text-muted-foreground mt-1">
              <Link to="/billing/clients/$clientId" params={{ clientId: inv.clientId }} className="hover:text-foreground">{clientName(inv.clientId)}</Link>
              {" · "}{fmtDate(inv.periodFrom)} → {fmtDate(inv.periodTo)}
              {inv.poNumber && <> · PO {inv.poNumber}</>}
            </div>
          </div>
          <div className="text-right">
            <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize", STATUS_TONE[inv.status])}>{inv.status}</span>
            <div className="text-3xl font-semibold tabular-nums mt-2">{fmtINR(inv.totalLakhs)}</div>
            <div className="text-[11px] text-muted-foreground">issued {fmtDate(inv.issueDate)} · due {fmtDate(inv.dueDate)}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          {inv.status === "draft" && (
            <Action onClick={() => setInvoiceStatus(inv.id, "sent")}    icon={<Send className="size-3.5" />}>Mark sent</Action>
          )}
          {(inv.status === "sent" || inv.status === "overdue") && (
            <Action onClick={() => setInvoiceStatus(inv.id, "paid")}    icon={<CheckCircle2 className="size-3.5" />}>Mark paid</Action>
          )}
          {(inv.status === "sent" || inv.status === "overdue") && (
            <Action icon={<Bell className="size-3.5" />}>Send reminder</Action>
          )}
          <Action icon={<Download className="size-3.5" />}>Download PDF</Action>
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
                <th className="text-left font-medium px-2 py-2.5">Type</th>
                <th className="text-right font-medium px-4 py-2.5">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inv.lineItems.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground text-sm">No joinings in this period.</td></tr>
              )}
              {inv.lineItems.map((li) => (
                <tr key={li.eventId}>
                  <td className="px-4 py-3 font-medium">{li.candidateName}</td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">{li.positionTitle}</td>
                  <td className="px-2 py-3 text-xs">{fmtDate(li.joiningDate)}</td>
                  <td className="px-2 py-3 text-xs tabular-nums">{fmtINR(li.ctcLakhs)}</td>
                  <td className="px-2 py-3 text-xs">{li.feeBasis}</td>
                  <td className="px-2 py-3">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border", KIND_TONE[li.kind])}>
                      {li.kind === "replacement_covered" && <ShieldCheck className="size-3" />}
                      {KIND_LABEL[li.kind]}
                    </span>
                  </td>
                  <td className={cn("px-4 py-3 text-right tabular-nums font-medium", li.amountLakhs < 0 ? "text-warning" : li.amountLakhs === 0 ? "text-muted-foreground" : "")}>{fmtINR(li.amountLakhs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Total label="Subtotal"           value={fmtINR(inv.subtotalLakhs)} />
        <Total label={`GST ${terms.gstPct}%`} value={fmtINR(inv.gstLakhs)} />
        <Total label={`TDS ${terms.tdsPct}%`} value={`-${fmtINR(inv.tdsLakhs)}`} tone="muted" />
        <Total label="Net payable"        value={fmtINR(inv.totalLakhs)} tone="primary" />
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