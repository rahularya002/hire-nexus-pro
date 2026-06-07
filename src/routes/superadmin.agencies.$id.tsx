import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { SuperAdminShell } from "@/components/superadmin-shell";
import { getAgency, updateAgencyPlan, updateAgencyStatus, extendTrial } from "@/lib/superadmin.functions";

export const Route = createFileRoute("/superadmin/agencies/$id")({
  ssr: false,
  component: AgencyDetailPage,
});

function AgencyDetailPage() {
  const { id } = Route.useParams();
  const fetchAgency = useServerFn(getAgency);
  const setPlan = useServerFn(updateAgencyPlan);
  const setStatus = useServerFn(updateAgencyStatus);
  const extend = useServerFn(extendTrial);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["sa", "agency", id],
    queryFn: () => fetchAgency({ data: { id } }),
  });

  const [plan, setPlanLocal] = useState<"starter" | "professional" | "enterprise">("starter");
  const [mrr, setMrr] = useState(0);

  const agency = data?.agency;
  const members = data?.members ?? [];

  // hydrate local edits when data loads
  if (agency && (plan !== agency.plan || mrr === 0 && agency.mrr_cents !== 0)) {
    if (plan === "starter" && agency.plan !== "starter") setPlanLocal(agency.plan);
    if (mrr === 0 && agency.mrr_cents !== 0) setMrr(agency.mrr_cents);
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["sa"] });

  const savePlan = async () => {
    try {
      await setPlan({ data: { id, plan, mrrCents: mrr } });
      toast.success("Plan updated");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <SuperAdminShell>
      {isLoading || !agency ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div>
            <Link to="/superadmin/agencies" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3" /> All agencies
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{agency.name}</h1>
            <p className="text-sm text-muted-foreground">{agency.slug} · Owner: {(agency as { owner_email?: string | null }).owner_email ?? "—"}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card label="Status" value={agency.status} />
            <Card label="Plan" value={agency.plan} />
            <Card label="MRR" value={`$${(agency.mrr_cents / 100).toLocaleString()}`} />
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="font-medium">Manage subscription</div>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-xs">
                <div className="text-muted-foreground mb-1">Plan</div>
                <select value={plan} onChange={(e) => setPlanLocal(e.target.value as typeof plan)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
              <label className="text-xs">
                <div className="text-muted-foreground mb-1">MRR (USD)</div>
                <input type="number" min={0} value={mrr / 100} onChange={(e) => setMrr(Math.round(Number(e.target.value) * 100))} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" />
              </label>
              <div className="flex items-end">
                <button onClick={savePlan} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Save plan</button>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex flex-wrap gap-2">
              <Action label="Approve" onClick={async () => { await setStatus({ data: { id, status: "active" } }); toast.success("Approved"); refresh(); }} />
              <Action label="Suspend" onClick={async () => { await setStatus({ data: { id, status: "suspended" } }); toast.success("Suspended"); refresh(); }} />
              <Action label="Reject" onClick={async () => { await setStatus({ data: { id, status: "rejected" } }); toast.success("Rejected"); refresh(); }} />
              <Action label="+14d trial" onClick={async () => { await extend({ data: { id, days: 14 } }); toast.success("Trial extended"); refresh(); }} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border font-medium">Members ({members.length})</div>
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left px-4 py-2 font-medium">Name</th><th className="text-left px-4 py-2 font-medium">Email</th><th className="text-left px-4 py-2 font-medium">Role</th></tr>
              </thead>
              <tbody>
                {members.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No members.</td></tr>
                )}
                {members.map((m) => (
                  <tr key={m.user_id} className="border-t border-border">
                    <td className="px-4 py-2">{m.full_name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{m.email ?? "—"}</td>
                    <td className="px-4 py-2 capitalize">{m.role_in_agency.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SuperAdminShell>
  );
}

function Card({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold capitalize">{value}</div>
    </div>
  );
}

function Action({ label, onClick }: { label: string; onClick: () => void | Promise<void> }) {
  return (
    <button onClick={onClick} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary">
      {label}
    </button>
  );
}