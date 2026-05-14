import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Trophy, CalendarCheck, FileText, Wallet, IndianRupee } from "lucide-react";
import { positions, clients } from "@/lib/mock-data";

export const Route = createFileRoute("/closed")({
  component: () => <AppShell><Page /></AppShell>,
});

type Billing = { joinedOn: string; invoiceRaisedOn: string; paymentReceivedOn: string | null; candidateCtc: string };

function billingFor(id: string, salary: string): Billing {
  // Deterministic mock billing data derived from position id
  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = new Date(2025, (seed % 10), 5 + (seed % 20));
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const joined = base;
  const invoice = new Date(base); invoice.setDate(base.getDate() + 2);
  const paid = new Date(base); paid.setDate(base.getDate() + 18 + (seed % 12));
  const isPaid = seed % 4 !== 0;
  return {
    joinedOn: fmt(joined),
    invoiceRaisedOn: fmt(invoice),
    paymentReceivedOn: isPaid ? fmt(paid) : null,
    candidateCtc: salary,
  };
}

function Page() {
  const list = positions.filter(p => p.status === "closed");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Closed positions</h1>
        <p className="text-sm text-muted-foreground mt-1">Successful placements and historical mandates</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {list.map(p => {
          const c = clients.find(x => x.id === p.clientId)!;
          const b = billingFor(p.id, p.salary);
          return (
            <div key={p.id} className="rounded-xl border border-border bg-gradient-to-br from-success/5 to-card p-5">
              <div className="flex items-center gap-2 text-success text-xs font-medium">
                <Trophy className="size-4" /> Successfully closed
              </div>
              <div className="font-semibold mt-2">{p.title}</div>
              <div className="text-xs text-muted-foreground">{c.name} · {p.location}</div>
              <div className="text-sm mt-3 text-muted-foreground">{p.openings} placement{p.openings>1?"s":""}</div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <Stat icon={<IndianRupee className="size-3.5" />} label="Candidate CTC" value={b.candidateCtc} valueClass="text-foreground font-semibold" />
                <Stat icon={<CalendarCheck className="size-3.5 text-success" />} label="Date of joining" value={b.joinedOn} />
                <Stat icon={<FileText className="size-3.5 text-info" />} label="Invoice raised" value={b.invoiceRaisedOn} />
                <Stat
                  icon={<Wallet className={"size-3.5 " + (b.paymentReceivedOn ? "text-success" : "text-warning")} />}
                  label="Payment received"
                  value={b.paymentReceivedOn ?? "Pending"}
                  valueClass={b.paymentReceivedOn ? "" : "text-warning font-medium"}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, valueClass = "" }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className={"text-xs mt-1 tabular-nums " + valueClass}>{value}</div>
    </div>
  );
}