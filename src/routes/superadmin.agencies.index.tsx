import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminShell } from "@/components/superadmin-shell";
import {
  listAgencies,
  updateAgencyStatus,
  deleteAgency,
  extendTrial,
} from "@/lib/superadmin.functions";

export const Route = createFileRoute("/superadmin/agencies/")({
  ssr: false,
  component: AgenciesPage,
});

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  trial: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  suspended: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  rejected: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20",
  pending: "bg-sky-500/10 text-sky-600 border-sky-500/20",
};

function AgenciesPage() {
  const fetchList = useServerFn(listAgencies);
  const setStatus = useServerFn(updateAgencyStatus);
  const remove = useServerFn(deleteAgency);
  const extend = useServerFn(extendTrial);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sa", "agencies"],
    queryFn: () => fetchList(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["sa"] });

  const act = async (id: string, fn: () => Promise<unknown>, label: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(label);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <SuperAdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agencies</h1>
            <p className="text-sm text-muted-foreground mt-1">All recruitment agencies on the platform.</p>
          </div>
          <Link
            to="/superadmin/agencies/new"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="size-4" /> Create Agency
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Agency</th>
                  <th className="text-left px-4 py-3 font-medium">Owner</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">MRR</th>
                  <th className="text-left px-4 py-3 font-medium">Trial ends</th>
                  <th className="text-left px-4 py-3 font-medium">Members</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!isLoading && (data?.agencies ?? []).length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No agencies yet.</td></tr>
                )}
                {(data?.agencies ?? []).map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link to="/superadmin/agencies/$id" params={{ id: a.id }} className="font-medium hover:underline">
                        {a.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{a.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.owner_email ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{a.plan}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border capitalize ${STATUS_COLORS[a.status] ?? ""}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">${(a.mrr_cents / 100).toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.trial_ends_at ? new Date(a.trial_ends_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">{a.member_count}</td>
                    <td className="px-4 py-3 text-right space-x-1.5">
                      {a.status !== "active" && (
                        <button
                          disabled={busy === a.id}
                          onClick={() => act(a.id, () => setStatus({ data: { id: a.id, status: "active" } }), "Agency approved")}
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30"
                        >
                          Approve
                        </button>
                      )}
                      {a.status !== "suspended" && (
                        <button
                          disabled={busy === a.id}
                          onClick={() => act(a.id, () => setStatus({ data: { id: a.id, status: "suspended" } }), "Agency suspended")}
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30"
                        >
                          Suspend
                        </button>
                      )}
                      {a.status === "trial" && (
                        <button
                          disabled={busy === a.id}
                          onClick={() => act(a.id, () => extend({ data: { id: a.id, days: 14 } }), "Trial extended +14d")}
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-sky-500/10 hover:text-sky-600 hover:border-sky-500/30"
                        >
                          +14d trial
                        </button>
                      )}
                      <button
                        disabled={busy === a.id}
                        onClick={() => {
                          if (confirm(`Delete agency "${a.name}"? This cannot be undone.`)) {
                            act(a.id, () => remove({ data: { id: a.id } }), "Agency deleted");
                          }
                        }}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SuperAdminShell>
  );
}