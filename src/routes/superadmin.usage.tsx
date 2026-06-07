import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SuperAdminShell } from "@/components/superadmin-shell";
import { getUsageStats } from "@/lib/superadmin.functions";

export const Route = createFileRoute("/superadmin/usage")({
  ssr: false,
  component: UsagePage,
});

function UsagePage() {
  const fetchUsage = useServerFn(getUsageStats);
  const { data } = useQuery({ queryKey: ["sa", "usage"], queryFn: () => fetchUsage() });

  const t = data?.totals;

  return (
    <SuperAdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usage Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">Platform-wide activity. Per-tenant breakdown ships with multi-tenancy.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Tile label="Recruiters" value={t?.recruiters ?? "—"} />
          <Tile label="Clients" value={t?.clients ?? "—"} />
          <Tile label="Active jobs" value={t?.activeJobs ?? "—"} />
          <Tile label="Placements" value={t?.placements ?? "—"} />
          <Tile label="AI usage" value="—" hint="Tracked once metering ships" />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border font-medium">Agencies</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-2 font-medium">Agency</th><th className="text-left px-4 py-2 font-medium">Plan</th><th className="text-left px-4 py-2 font-medium">Status</th></tr>
            </thead>
            <tbody>
              {(data?.agencies ?? []).map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-2">{a.name}</td>
                  <td className="px-4 py-2 capitalize">{a.plan}</td>
                  <td className="px-4 py-2 capitalize">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminShell>
  );
}

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground/70">{hint}</div>}
    </div>
  );
}