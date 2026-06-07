import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SuperAdminShell } from "@/components/superadmin-shell";
import { getRevenueStats, listAgencies } from "@/lib/superadmin.functions";

export const Route = createFileRoute("/superadmin/revenue")({
  ssr: false,
  component: RevenuePage,
});

function RevenuePage() {
  const fetchStats = useServerFn(getRevenueStats);
  const fetchList = useServerFn(listAgencies);
  const { data: stats } = useQuery({ queryKey: ["sa", "revenue"], queryFn: () => fetchStats() });
  const { data: list } = useQuery({ queryKey: ["sa", "agencies"], queryFn: () => fetchList() });

  const now = Date.now();
  const renewals = (list?.agencies ?? [])
    .filter((a) => a.trial_ends_at)
    .map((a) => ({ ...a, t: new Date(a.trial_ends_at!).getTime() }))
    .sort((x, y) => x.t - y.t);

  return (
    <SuperAdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Revenue Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">MRR / ARR and renewal tracking. Values reflect manually-recorded subscriptions.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="MRR" value={stats ? `$${(stats.mrr_cents / 100).toLocaleString()}` : "—"} />
          <Tile label="ARR" value={stats ? `$${(stats.arr_cents / 100).toLocaleString()}` : "—"} />
          <Tile label="Active subs" value={stats?.activeCount ?? "—"} />
          <Tile label="Trials" value={stats?.trialCount ?? "—"} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Tile label="Starter" value={stats?.byPlan.starter ?? 0} />
          <Tile label="Professional" value={stats?.byPlan.professional ?? 0} />
          <Tile label="Enterprise" value={stats?.byPlan.enterprise ?? 0} />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border font-medium">Upcoming renewals / trial ends</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-2 font-medium">Agency</th><th className="text-left px-4 py-2 font-medium">Plan</th><th className="text-left px-4 py-2 font-medium">Status</th><th className="text-left px-4 py-2 font-medium">Trial ends</th><th className="text-left px-4 py-2 font-medium">In</th></tr>
            </thead>
            <tbody>
              {renewals.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No upcoming renewals.</td></tr>
              )}
              {renewals.map((r) => {
                const days = Math.round((r.t - now) / (24 * 60 * 60 * 1000));
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 capitalize">{r.plan}</td>
                    <td className="px-4 py-2 capitalize">{r.status}</td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(r.t).toLocaleDateString()}</td>
                    <td className={`px-4 py-2 ${days < 0 ? "text-rose-500" : days < 7 ? "text-amber-500" : "text-muted-foreground"}`}>
                      {days < 0 ? `${-days}d overdue` : `${days}d`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminShell>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}