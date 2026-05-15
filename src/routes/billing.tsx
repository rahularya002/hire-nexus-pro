import { createFileRoute, Link } from "@tanstack/react-router";
import { useSyncExternalStore, useState } from "react";
import { Receipt, Wallet, AlarmClock, ShieldCheck, TrendingUp, ChevronRight, CalendarClock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  billingKpis, upcomingRuns, listInvoices, joiningEvents, fmtINR, fmtDate,
  clientName, clientInitials, clientColor, subscribeBilling, getBillingVersion,
} from "@/lib/billing-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/billing")({
  component: () => <AppShell><Page /></AppShell>,
});

const STATUS_TONE = {
  draft:     "bg-muted/40 text-muted-foreground border-border",
  sent:      "bg-info/15 text-info border-info/25",
  paid:      "bg-success/15 text-success border-success/25",
  overdue:   "bg-destructive/15 text-destructive border-destructive/25",
  cancelled: "bg-muted/40 text-muted-foreground border-border line-through",
} as const;

const JE_TONE = {
  joined:           "bg-success/15 text-success border-success/25",
  replacement_for:  "bg-info/15 text-info border-info/25",
  left_in_window:   "bg-warning/15 text-warning border-warning/25",
  no_show:          "bg-destructive/15 text-destructive border-destructive/25",
} as const;

const JE_LABEL = {
  joined: "Joined",
  replacement_for: "Replacement",
  left_in_window: "Left in window",
  no_show: "No-show",
} as const;

function Page() {
  useSyncExternalStore(subscribeBilling, getBillingVersion, getBillingVersion);
  const k = billingKpis();
  const runs = upcomingRuns();
  const invs = listInvoices().sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const [tab, setTab] = useState<"invoices" | "ledger">("invoices");

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
        <Kpi icon={<TrendingUp className="size-4" />} label="MTD invoiced"        value={fmtINR(k.mtdLakhs)} />
        <Kpi icon={<Wallet className="size-4" />}     label="Outstanding"          value={fmtINR(k.outstandingLakhs)} tone="info" />
        <Kpi icon={<AlarmClock className="size-4" />} label="Overdue"              value={fmtINR(k.overdueLakhs)} tone={k.overdueLakhs > 0 ? "destructive" : "default"} />
        <Kpi icon={<CalendarClock className="size-4" />} label="Cycle accrual"     value={fmtINR(k.forecastLakhs)} />
        <Kpi icon={<ShieldCheck className="size-4" />} label="In replacement window" value={`${k.replacementsActive}`} />
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2.5">Upcoming invoice runs</h2>
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {runs.map((r) => (
            <Link
              key={r.client.id}
              to="/billing/clients/$clientId"
              params={{ clientId: r.client.id }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition"
            >
              <div className="size-9 rounded-lg grid place-items-center text-[11px] font-bold text-primary-foreground" style={{ background: r.client.color }}>
                {r.client.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{r.client.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.terms.billingCycle === "monthly" ? `Monthly · day ${r.terms.invoiceDayOfMonth}` : "Per joining"}
                  {" · "}Net {r.terms.paymentTermsDays}
                  {" · "}{r.terms.feeModel === "percent_ctc" ? `${r.terms.feeValue}% CTC` : r.terms.feeModel === "flat_per_hire" ? `Flat ${fmtINR(r.terms.feeValue)}` : "Tiered"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs">Next run · <span className="font-medium">{fmtDate(r.nextRun)}</span></div>
                <div className="text-[11px] text-muted-foreground">{r.daysAway <= 0 ? "Due today" : `in ${r.daysAway}d`} · accrual {fmtINR(r.preview?.total ?? 0)}</div>
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
                  <th className="text-left font-medium px-2 py-2.5">Client</th>
                  <th className="text-left font-medium px-2 py-2.5">Period</th>
                  <th className="text-left font-medium px-2 py-2.5">Issued / Due</th>
                  <th className="text-right font-medium px-2 py-2.5">Total</th>
                  <th className="text-right font-medium px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invs.map((i) => (
                  <tr key={i.id} className="hover:bg-secondary/30 transition">
                    <td className="px-4 py-3">
                      <Link to="/billing/invoices/$invoiceId" params={{ invoiceId: i.id }} className="font-medium hover:text-primary">
                        {i.invoiceNo}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">{i.lineItems.length} line item{i.lineItems.length === 1 ? "" : "s"}</div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-md grid place-items-center text-[10px] font-bold text-primary-foreground" style={{ background: clientColor(i.clientId) }}>{clientInitials(i.clientId)}</div>
                        <span className="text-xs">{clientName(i.clientId)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-xs text-muted-foreground">{fmtDate(i.periodFrom)} → {fmtDate(i.periodTo)}</td>
                    <td className="px-2 py-3 text-xs">
                      <div>{fmtDate(i.issueDate)}</div>
                      <div className="text-muted-foreground">due {fmtDate(i.dueDate)}</div>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums font-medium">{fmtINR(i.totalLakhs)}</td>
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
                  <th className="text-right font-medium px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {joiningEvents.slice().sort((a, b) => b.joiningDate.localeCompare(a.joiningDate)).map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-full bg-gradient-to-br from-primary/40 to-purple-500/40 grid place-items-center text-[10px] font-semibold">{e.initials}</div>
                        <span className="font-medium">{e.candidateName}</span>
                      </div>
                      {e.notes && <div className="text-[10px] text-muted-foreground mt-1 ml-9">{e.notes}</div>}
                    </td>
                    <td className="px-2 py-3 text-xs">
                      <div>{clientName(e.clientId)}</div>
                      <div className="text-muted-foreground">{e.positionTitle}</div>
                    </td>
                    <td className="px-2 py-3 text-xs tabular-nums">{fmtINR(e.ctcLakhs)}</td>
                    <td className="px-2 py-3 text-xs">{fmtDate(e.joiningDate)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", JE_TONE[e.status])}>
                        {JE_LABEL[e.status]}
                      </span>
                    </td>
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