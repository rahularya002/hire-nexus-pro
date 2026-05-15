import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { ArrowLeft, Receipt, ShieldCheck, FileText, Settings2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  getTerms, previewCurrentCycle, invoicesForClient, activeReplacementWindow,
  fmtINR, fmtDate, clientName, clientInitials, clientColor,
  subscribeBilling, getBillingVersion,
} from "@/lib/billing-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/billing/clients/$clientId")({
  component: () => <AppShell><Page /></AppShell>,
});

const STATUS_TONE = {
  draft:     "bg-muted/40 text-muted-foreground border-border",
  sent:      "bg-info/15 text-info border-info/25",
  paid:      "bg-success/15 text-success border-success/25",
  overdue:   "bg-destructive/15 text-destructive border-destructive/25",
  cancelled: "bg-muted/40 text-muted-foreground border-border",
} as const;

function Page() {
  useSyncExternalStore(subscribeBilling, getBillingVersion, getBillingVersion);
  const { clientId } = Route.useParams();
  const terms = getTerms(clientId);
  if (!terms) throw notFound();
  const preview = previewCurrentCycle(clientId)!;
  const invs = invoicesForClient(clientId).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const guarantees = activeReplacementWindow(clientId);

  return (
    <div className="space-y-6">
      <Link to="/billing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Billing overview
      </Link>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 p-6 flex items-start gap-5">
        <div className="size-14 rounded-xl grid place-items-center text-lg font-bold text-primary-foreground" style={{ background: clientColor(clientId) }}>
          {clientInitials(clientId)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Billing profile</div>
          <h1 className="text-2xl font-semibold tracking-tight">{clientName(clientId)}</h1>
          <p className="text-sm text-muted-foreground mt-1">Custom contractual terms · invoiced on actual joinings.</p>
        </div>
      </div>

      <section className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2"><Settings2 className="size-4 text-primary" /> Commercial terms</h2>
            <button className="text-xs text-muted-foreground hover:text-foreground">Edit terms</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
            <Term label="Fee model" value={
              terms.feeModel === "percent_ctc" ? `${terms.feeValue}% of CTC` :
              terms.feeModel === "flat_per_hire" ? `Flat ${fmtINR(terms.feeValue)} per hire` :
              `Tiered (${terms.tiers?.length} bands)`
            } />
            <Term label="Billing cycle" value={terms.billingCycle === "monthly" ? `Monthly · invoice on day ${terms.invoiceDayOfMonth}` : "Per joining"} />
            <Term label="Payment terms" value={`Net ${terms.paymentTermsDays}`} />
            <Term label="Replacement window" value={`${terms.replacementWindowDays} days · ${terms.replacementPolicy.replace(/_/g," ")}`} />
            <Term label="Taxes" value={`GST ${terms.gstPct}% · TDS ${terms.tdsPct}%`} />
            <Term label="Purchase order" value={terms.poRequired ? (terms.poNumber ?? "Required") : "Not required"} />
          </div>
          {terms.feeModel === "tiered" && terms.tiers && (
            <div className="mt-4 rounded-lg border border-border/60 bg-secondary/30 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Tier table</div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border/60">
                  {terms.tiers.map((t, i) => (
                    <tr key={i}>
                      <td className="py-1.5">CTC ≤ {t.upToCtcLakhs} L</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{fmtINR(t.flatFeeLakhs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2"><Receipt className="size-4 text-primary" /> Current cycle</h2>
          <div className="mt-3 text-xs text-muted-foreground">{fmtDate(preview.from)} → {fmtDate(preview.to)}</div>
          <div className="text-3xl font-semibold tabular-nums mt-2">{fmtINR(preview.total)}</div>
          <div className="text-[11px] text-muted-foreground">{preview.items.length} line item{preview.items.length === 1 ? "" : "s"} · issues {fmtDate(preview.issueDate)}</div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-[11px]">
            <Mini label="Subtotal" value={fmtINR(preview.subtotal)} />
            <Mini label={`GST ${terms.gstPct}%`} value={fmtINR(preview.gst)} />
            <Mini label={`TDS ${terms.tdsPct}%`} value={`-${fmtINR(preview.tds)}`} tone="muted" />
          </div>
        </div>
      </section>

      {preview.items.length > 0 && (
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
                {preview.items.map((li) => (
                  <tr key={li.eventId} className="hover:bg-secondary/30 transition">
                    <td className="px-4 py-3 font-medium">{li.candidateName}</td>
                    <td className="px-2 py-3 text-xs text-muted-foreground">{li.positionTitle}</td>
                    <td className="px-2 py-3 text-xs">{fmtDate(li.joiningDate)}</td>
                    <td className="px-2 py-3 text-xs">{li.feeBasis}</td>
                    <td className={cn("px-4 py-3 text-right tabular-nums font-medium", li.amountLakhs < 0 ? "text-warning" : li.amountLakhs === 0 ? "text-muted-foreground" : "")}>{fmtINR(li.amountLakhs)}</td>
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
            {invs.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No invoices yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {invs.map((i) => (
                  <li key={i.id}>
                    <Link to="/billing/invoices/$invoiceId" params={{ invoiceId: i.id }} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{i.invoiceNo}</div>
                        <div className="text-[11px] text-muted-foreground">{fmtDate(i.periodFrom)} → {fmtDate(i.periodTo)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm tabular-nums">{fmtINR(i.totalLakhs)}</div>
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
                  <li key={g.event.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{g.event.candidateName}</div>
                      <div className="text-xs text-muted-foreground">{g.remaining}d left</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{g.event.positionTitle} · joined {fmtDate(g.event.joiningDate)}</div>
                    <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-success" style={{ width: `${Math.min(100, (g.elapsed / terms.replacementWindowDays) * 100)}%` }} />
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

function Mini({ label, value, tone }: { label: string; value: string; tone?: "muted" }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-xs mt-0.5 tabular-nums font-medium", tone === "muted" && "text-muted-foreground")}>{value}</div>
    </div>
  );
}