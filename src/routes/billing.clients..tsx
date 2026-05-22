import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Receipt, ShieldCheck, FileText, Settings2, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  getClientBilling, generateInvoiceForClient, fmtINR, fmtDate,
  type InvoiceStatus,
} from "@/lib/billing.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/billing/clients/$clientId")({
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
  const { clientId } = Route.useParams();
  const qc = useQueryClient();
  const fn = useServerFn(getClientBilling);
  const genFn = useServerFn(generateInvoiceForClient);
  const q = useQuery({ queryKey: ["billing", "client", clientId], queryFn: () => fn({ data: { clientId } }) });
  const gen = useMutation({
    mutationFn: () => genFn({ data: { clientId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });

  if (q.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (q.data === null) throw notFound();
  const d = q.data!;
  const { client, terms, cycle, invoices, guarantees } = d;
  const initials = client.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6">
      <Link to="/billing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Billing overview
      </Link>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 p-6 flex items-start gap-5">
        <div className="size-14 rounded-xl grid place-items-center text-lg font-bold text-primary-foreground bg-primary">{initials}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Billing profile</div>
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Custom contractual terms · invoiced on actual joinings.</p>
        </div>
        <button
          onClick={() => gen.mutate()}
          disabled={gen.isPending || cycle.items.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition"
        >
          <Plus className="size-4" /> {gen.isPending ? "Generating…" : "Generate invoice"}
        </button>
      </div>

      <section className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2"><Settings2 className="size-4 text-primary" /> Commercial terms</h2>
          <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
            <Term label="Fee model" value={
              terms.fee_model === "percent_ctc" ? `${terms.fee_value}% of CTC` :
              terms.fee_model === "flat_per_hire" ? `Flat ${fmtINR(terms.fee_value)} per hire` :
              `Tiered (${terms.tiers?.length ?? 0} bands)`
            } />
            <Term label="Billing cycle" value={terms.billing_cycle === "monthly" ? `Monthly · invoice on day ${terms.invoice_day_of_month}` : "Per joining"} />
            <Term label="Payment terms" value={`Net ${terms.payment_terms_days}`} />
            <Term label="Replacement window" value={`${terms.replacement_window_days} days · ${terms.replacement_policy.replace(/_/g," ")}`} />
            <Term label="Taxes" value={`GST ${terms.gst_pct}% · TDS ${terms.tds_pct}%`} />
            <Term label="Purchase order" value={terms.po_required ? (terms.po_number ?? "Required") : "Not required"} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2"><Receipt className="size-4 text-primary" /> Current cycle</h2>
          <div className="mt-3 text-xs text-muted-foreground">{fmtDate(cycle.from)} → {fmtDate(cycle.to)}</div>
          <div className="text-3xl font-semibold tabular-nums mt-2">{fmtINR(cycle.total)}</div>
          <div className="text-[11px] text-muted-foreground">{cycle.items.length} line item{cycle.items.length === 1 ? "" : "s"} · issues {fmtDate(cycle.issueDate)}</div>
        </div>
      </section>

      {cycle.items.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2.5">Open cycle accrual</h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Candidate</th>
                  <th className="text-left font-medium px-2 py-2.5">Position</th>
                  <th className="text-left font-medium px-2 py-2.5">Joining</th>
                  <th className="text-left font-medium px-2 py-2.5">Fee basis</th>
                  <th className="text-right font-medium px-4 py-2.5">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cycle.items.map((li) => (
                  <tr key={li.placement_id} className="hover:bg-secondary/30 transition">
                    <td className="px-4 py-3 font-medium">{li.candidate_name}</td>
                    <td className="px-2 py-3 text-xs text-muted-foreground">{li.position_title}</td>
                    <td className="px-2 py-3 text-xs">{fmtDate(li.joining_date)}</td>
                    <td className="px-2 py-3 text-xs">{li.fee_basis}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtINR(li.amount_inr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid lg:grid-cols-2 gap-4">
        <div>
          <h2 className="text-sm font-semibold mb-2.5 inline-flex items-center gap-2"><FileText className="size-4 text-primary" /> Invoice history</h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {invoices.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No invoices yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {invoices.map((i) => (
                  <li key={i.id}>
                    <Link to="/billing/invoices/$invoiceId" params={{ invoiceId: i.id }} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{i.invoice_no}</div>
                        <div className="text-[11px] text-muted-foreground">{fmtDate(i.period_from)} → {fmtDate(i.period_to)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm tabular-nums">{fmtINR(Number(i.total_inr))}</div>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize", STATUS_TONE[i.status])}>{i.status}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-2.5 inline-flex items-center gap-2"><ShieldCheck className="size-4 text-success" /> Active replacement window</h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {guarantees.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No active guarantees.</div>
            ) : (
              <ul className="divide-y divide-border">
                {guarantees.map((g) => (
                  <li key={g.placement_id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{g.candidate_name}</div>
                      <div className="text-xs text-muted-foreground">{g.remaining}d left</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{g.position_title} · joined {fmtDate(g.joining_date)}</div>
                    <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-success" style={{ width: `${Math.min(100, (g.elapsed / terms.replacement_window_days) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5 capitalize">{value}</div>
    </div>
  );
}
