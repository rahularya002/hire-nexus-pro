import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Building2, DollarSign, TrendingUp, AlertTriangle, LifeBuoy } from "lucide-react";
import { SuperAdminShell } from "@/components/superadmin-shell";
import { getRevenueStats, listTickets } from "@/lib/superadmin.functions";

export const Route = createFileRoute("/superadmin/")({
  ssr: false,
  component: SuperAdminOverview,
});

function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function SuperAdminOverview() {
  const fetchStats = useServerFn(getRevenueStats);
  const fetchTickets = useServerFn(listTickets);
  const stats = useQuery({ queryKey: ["sa", "revenue"], queryFn: () => fetchStats() });
  const tix = useQuery({ queryKey: ["sa", "tickets"], queryFn: () => fetchTickets() });
  const openTickets = (tix.data?.tickets ?? []).filter((t) => t.status === "open" || t.status === "in_progress").length;

  const tiles = [
    { label: "MRR", value: stats.data ? fmtMoney(stats.data.mrr_cents) : "—", icon: DollarSign, hint: "Active subscriptions" },
    { label: "ARR", value: stats.data ? fmtMoney(stats.data.arr_cents) : "—", icon: TrendingUp, hint: "MRR × 12" },
    { label: "Active Agencies", value: stats.data?.activeCount ?? "—", icon: Building2, hint: `${stats.data?.totalAgencies ?? "—"} total` },
    { label: "Trials", value: stats.data?.trialCount ?? "—", icon: AlertTriangle, hint: `${stats.data?.trialsExpiringSoon ?? 0} expiring in 7d` },
    { label: "Open tickets", value: openTickets, icon: LifeBuoy, hint: "Support inbox" },
  ];

  return (
    <SuperAdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage tenant agencies, subscriptions and support.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="size-3.5" /> {t.label}
                </div>
                <div className="mt-2 text-2xl font-semibold">{t.value}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{t.hint}</div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link to="/superadmin/agencies" className="rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition">
            <div className="font-medium">Agencies</div>
            <p className="text-xs text-muted-foreground mt-1">Create, approve, suspend or delete recruitment agencies.</p>
          </Link>
          <Link to="/superadmin/subscriptions" className="rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition">
            <div className="font-medium">Subscriptions</div>
            <p className="text-xs text-muted-foreground mt-1">Manage plans (Starter / Professional / Enterprise) per agency.</p>
          </Link>
          <Link to="/superadmin/support" className="rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition">
            <div className="font-medium">Support Center</div>
            <p className="text-xs text-muted-foreground mt-1">Tickets, billing requests and feature requests.</p>
          </Link>
        </div>
      </div>
    </SuperAdminShell>
  );
}