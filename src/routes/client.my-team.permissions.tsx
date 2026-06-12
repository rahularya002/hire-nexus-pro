import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ArrowLeft, Save } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  getClientRolePermissions,
  updateClientRolePermissions,
  CLIENT_PERMISSIONS,
  type ClientMemberRole,
} from "@/lib/client-team.functions";

export const Route = createFileRoute("/client/my-team/permissions")({
  component: () => (
    <ClientShell>
      <Page />
    </ClientShell>
  ),
});

const editableRoles: { id: Exclude<ClientMemberRole, "client_admin">; label: string; desc: string }[] = [
  { id: "client_recruiter", label: "Recruiter", desc: "Sources and submits candidates; can schedule interviews." },
  { id: "client_viewer",    label: "Viewer",    desc: "Read-only access to positions and candidates." },
];

function permLabel(p: string): string {
  return p
    .replace(/^[a-z]+\./, (m) => m.charAt(0).toUpperCase() + m.slice(1, -1) + " · ")
    .replace(/\./g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Page() {
  const qc = useQueryClient();
  const fetchPerms = useServerFn(getClientRolePermissions);
  const updateFn = useServerFn(updateClientRolePermissions);
  const { data, isLoading } = useQuery({
    queryKey: ["client-role-permissions"],
    queryFn: () => fetchPerms(),
  });

  const [local, setLocal] = useState<Record<string, Set<string>>>({});
  useEffect(() => {
    if (!data) return;
    setLocal({
      client_recruiter: new Set(data.rows.client_recruiter),
      client_viewer: new Set(data.rows.client_viewer),
    });
  }, [data]);

  function toggle(role: string, perm: string) {
    setLocal((prev) => {
      const next = { ...prev, [role]: new Set(prev[role] ?? []) };
      if (next[role].has(perm)) next[role].delete(perm);
      else next[role].add(perm);
      return next;
    });
  }

  async function save(role: "client_recruiter" | "client_viewer") {
    try {
      await updateFn({ data: { role, permissions: Array.from(local[role] ?? []) } });
      toast.success("Permissions saved");
      qc.invalidateQueries({ queryKey: ["client-role-permissions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/client/my-team"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> My Team
      </Link>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          What each role can do
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" /> Roles & Permissions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Admin always has full access. Customize Recruiter and Viewer below.
        </p>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
          Loading permissions…
        </div>
      )}

      {!isLoading &&
        editableRoles.map((r) => {
          const set = local[r.id] ?? new Set<string>();
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-base font-semibold">{r.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
                </div>
                <button
                  onClick={() => save(r.id)}
                  className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                >
                  <Save className="size-3.5" /> Save
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {CLIENT_PERMISSIONS.map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-secondary/40"
                  >
                    <Checkbox
                      checked={set.has(p)}
                      onCheckedChange={() => toggle(r.id, p)}
                    />
                    <span>{permLabel(p)}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}