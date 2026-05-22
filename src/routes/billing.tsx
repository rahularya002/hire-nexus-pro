import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Wallet, AlarmClock, ShieldCheck, TrendingUp, ChevronRight, CalendarClock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  billingKpis, upcomingRuns, listInvoices, listJoiningsLedger, fmtINR, fmtDate,
  type InvoiceStatus,
} from "@/lib/billing.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/billing")({
  component: () => <AppShell><Page /></AppShell>,
});

const STATUS_TONE: Record<InvoiceStatus, string> = {
  draft:     "bg-muted/40 text-muted-foreground border-border",
  sent:      "bg-info/15 text-info border-info/25",
  paid:      "bg-success/15 text-success border-success/25",
  overdue:   "bg-destructive/15 text-destructive border-destructive/25",
  cancelled: "bg-muted/40 text-muted-foreground border-border line-through",
};

function Page() {
  const kFn = useServerFn(billingKpis);
  const rFn = useServerFn(upcomingRuns);
  const iFn = useServerFn(listInvoices);
  const lFn = useServerFn(listJoiningsLedger);
  const kpis = useQuery({ queryKey: ["billing", "kpis"], queryFn: () => kFn() });
  const runs = useQuery({ queryKey: ["billing", "runs"], queryFn: () => rFn() });
  const invs = useQuery({ queryKey: ["billing", "invoices"], queryFn: () => iFn() });
  const ledger = useQuery({ queryKey: ["billing", "ledger"], queryFn: () => lFn() });
  const [tab, setTab] = useState<"invoices" | "ledger">("invoices");
  const k = kpis.data;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Finance</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
            <Receipt className="size-5 text-primary" /> Billing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Per-client custom terms · invoiced on actual joinings.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={<TrendingUp className="size-4" />} label="MTD invoiced"        value={fmtINR(k?.mtdInr ?? 0)} />
        <Kpi icon={<Wallet className="size-4" />}     label="Outstanding"          value={fmtINR(k?.outstandingInr ?? 0)} tone="info" />
        <Kpi icon={<AlarmClock className="size-4" />} label="Overdue"              value={fmtINR(k?.overdueInr ?? 0)} tone={(k?.overdueInr ?? 0) > 0 ? "destructive" : "default"} />
        <Kpi icon={<CalendarClock className="size-4" />} label="Cycle accrual"     value={fmtINR(k?.forecastInr ?? 0)} />
        <Kpi icon={<ShieldCheck className="size-4" />} label="In replacement window" value={`${k?.replacementsActive ?? 0}`} />
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2.5">Upcoming invoice runs</h2>
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {(runs.data ?? []).length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground">No clients yet.</div>
          )}
          {(runs.data ?? []).map((r) => (
            <Link
              key={r.client.id}
              to="/billing/clients/$clientId"
              params={{ clientId: r.client.id }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition"
            >
              <div className="size-9 rounded-lg grid place-items-center text-[11px] font-bold text-primary-foreground" style={{ background: r.client.color ?? "oklch(0.55 0.15 250)" }}>
                {r.client.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{r.client.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.terms.billing_cycle === "monthly" ? `Monthly · day ${r.terms.invoice_day_of_month}` : "Per joining"}
                  {" · "}Net {r.terms.payment_terms_days}
                  {" · "}{r.terms.fee_model === "percent_ctc" ? `${r.terms.fee_value}% CTC` : r.terms.fee_model === "flat_per_hire" ? `Flat ${fmtINR(r.terms.fee_value)}` : "Tiered"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs">Next run · <span className="font-medium">{fmtDate(r.nextRun)}</span></div>
                <div className="text-[11px] text-muted-foreground">{r.daysAway <= 0 ? "Due today" : `in ${r.daysAway}d`} · accrual {fmtINR(r.previewTotal)}</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setTab("invoices")} className={cn("text-sm px-3 py-1.5 rounded-md border", tab === "invoices" ? "bg-secondary border-border" : "border-transparent text-muted-foreground hover:text-foreground")}>Invoices</button>
          <button onClick={() => setTab("ledger")}   className={cn("text-sm px-3 py-1.5 rounded-md border", tab === "ledger"   ? "bg-secondary border-border" : "border-transparent text-muted-foreground hover:text-foreground")}>Joinings ledger</button>
        </div>

        {tab === "invoices" ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Invoice</th>
                  <th className="text-left font-medium px-2 py-2.5">Period</th>
                  <th className="text-left font-medium px-2 py-2.5">Issued / Due</th>
                  <th className="text-right font-medium px-2 py-2.5">Total</th>
                  <th className="text-right font-medium px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(invs.data ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">No invoices yet.</td></tr>
                )}
                {(invs.data ?? []).map((i) => (
                  <tr key={i.id} className="hover:bg-secondary/30 transition">
                    <td className="px-4 py-3">
                      <Link to="/billing/invoices/$invoiceId" params={{ invoiceId: i.id }} className="font-medium hover:text-primary">
                        {i.invoice_no}
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-xs text-muted-foreground">{fmtDate(i.period_from)} → {fmtDate(i.period_to)}</td>
                    <td className="px-2 py-3 text-xs">
                      <div>{fmtDate(i.issue_date)}</div>
                      <div className="text-muted-foreground">due {fmtDate(i.due_date)}</div>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums font-medium">{fmtINR(Number(i.total_inr))}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize", STATUS_TONE[i.status])}>{i.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Candidate</th>
                  <th className="text-left font-medium px-2 py-2.5">Client / Position</th>
                  <th className="text-left font-medium px-2 py-2.5">CTC</th>
                  <th className="text-left font-medium px-2 py-2.5">Joining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(ledger.data ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">No joinings yet.</td></tr>
                )}
                {(ledger.data ?? []).map((e) => (
                  <tr key={e.placement_id} className="hover:bg-secondary/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-full bg-gradient-to-br from-primary/40 to-purple-500/40 grid place-items-center text-[10px] font-semibold">{e.initials}</div>
                        <span className="font-medium">{e.candidate_name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-xs">
                      <div>{e.client_name}</div>
                      <div className="text-muted-foreground">{e.position_title}</div>
                    </td>
                    <td className="px-2 py-3 text-xs tabular-nums">{fmtINR(e.ctc_inr)}</td>
                    <td className="px-2 py-3 text-xs">{fmtDate(e.joining_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon, label, value, tone = "default" }: { icon: React.ReactNode; label: string; value: string; tone?: "default" | "info" | "destructive" }) {
  const toneCls = tone === "info" ? "text-info" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className={cn("text-2xl font-semibold tabular-nums mt-1", toneCls)}>{value}</div>
    </div>
  );
}
