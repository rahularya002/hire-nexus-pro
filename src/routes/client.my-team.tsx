import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users2, Plus, ShieldCheck, Trash2, Mail, Save, Pencil } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  listClientMembers,
  inviteClientMember,
  updateClientMemberRole,
  removeClientMember,
  getClientRolePermissions,
  updateClientRolePermissions,
  listClientCustomRoles,
  createClientCustomRole,
  updateClientCustomRole,
  deleteClientCustomRole,
  CLIENT_PERMISSIONS,
  type ClientMemberRole,
  type ClientCustomRole,
} from "@/lib/client-team.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/my-team")({
  component: () => (
    <ClientShell>
      <Page />
    </ClientShell>
  ),
});

type RoleSelectValue =
  | { kind: "builtin"; value: ClientMemberRole }
  | { kind: "custom"; value: string };

const builtinLabel: Record<ClientMemberRole, string> = {
  client_admin: "Admin",
  client_recruiter: "Recruiter",
  client_viewer: "Viewer",
};

function encodeRoleValue(v: RoleSelectValue): string {
  return v.kind === "builtin" ? `b:${v.value}` : `c:${v.value}`;
}
function decodeRoleValue(s: string): RoleSelectValue {
  const [k, ...rest] = s.split(":");
  const value = rest.join(":");
  return k === "c" ? { kind: "custom", value } : { kind: "builtin", value: value as ClientMemberRole };
}

function permLabel(p: string): string {
  const [group, action] = p.split(".");
  const g = group ? group.charAt(0).toUpperCase() + group.slice(1) : p;
  const a = action ? action.charAt(0).toUpperCase() + action.slice(1) : "";
  return a ? `${g} · ${a}` : g;
}

function Page() {
  const [tab, setTab] = useState<"members" | "perms">(() => {
    if (typeof window === "undefined") return "members";
    return new URLSearchParams(window.location.search).get("tab") === "permissions" ? "perms" : "members";
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Your in-house recruiters
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
          <Users2 className="size-5 text-primary" /> My Team
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite teammates and decide what each role can do.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
        <button
          onClick={() => setTab("members")}
          className={cn(
            "px-3 h-8 rounded-md font-medium inline-flex items-center gap-1.5",
            tab === "members" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Users2 className="size-4" /> Members
        </button>
        <button
          onClick={() => setTab("perms")}
          className={cn(
            "px-3 h-8 rounded-md font-medium inline-flex items-center gap-1.5",
            tab === "perms" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ShieldCheck className="size-4" /> Roles & Permissions
        </button>
      </div>

      {tab === "members" ? <MembersTab /> : <PermissionsTab />}
    </div>
  );
}

function MembersTab() {
  const qc = useQueryClient();
  const fetchMembers = useServerFn(listClientMembers);
  const fetchCustom = useServerFn(listClientCustomRoles);
  const updateRoleFn = useServerFn(updateClientMemberRole);
  const removeFn = useServerFn(removeClientMember);
  const { data, isLoading } = useQuery({
    queryKey: ["client-my-team"],
    queryFn: () => fetchMembers(),
  });
  const { data: customData } = useQuery({
    queryKey: ["client-custom-roles"],
    queryFn: () => fetchCustom(),
  });
  const customRoles = customData?.roles ?? [];
  const [inviteOpen, setInviteOpen] = useState(false);
  const members = data?.members ?? [];

  async function onChangeRole(memberId: string, encoded: string) {
    const v = decodeRoleValue(encoded);
    try {
      await updateRoleFn({
        data: {
          memberId,
          role: v.kind === "builtin" ? v.value : undefined,
          customRoleId: v.kind === "custom" ? v.value : undefined,
        },
      });
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["client-my-team"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update role");
    }
  }

  async function onRemove(memberId: string) {
    if (!confirm("Remove this teammate from your account?")) return;
    try {
      await removeFn({ data: { memberId } });
      toast.success("Teammate removed");
      qc.invalidateQueries({ queryKey: ["client-my-team"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove teammate");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setInviteOpen(true)}
          className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="size-4" /> Invite teammate
        </button>
      </div>

      {data?.clientId === null && (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Only the primary client account can manage teammates.
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-secondary/30">
          <div className="col-span-5">Member</div>
          <div className="col-span-3">Role</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        <div className="divide-y divide-border">
          {isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading team…</div>
          )}
          {!isLoading && members.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No teammates yet. Invite your first recruiter to get started.
            </div>
          )}
          {members.map((m) => {
            const initials = (m.full_name ?? m.invited_email ?? "?")
              .split(/\s+/)
              .map((s) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const currentValue: RoleSelectValue = m.custom_role_id
              ? { kind: "custom", value: m.custom_role_id }
              : { kind: "builtin", value: (m.role ?? "client_viewer") as ClientMemberRole };
            return (
              <div key={m.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-4 items-center">
                <div className="md:col-span-5 flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-lg bg-gradient-to-br from-info to-purple text-primary-foreground grid place-items-center text-xs font-semibold shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.full_name ?? "Teammate"}</div>
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate">
                      <Mail className="size-3" /> {m.invited_email ?? "—"}
                    </div>
                  </div>
                </div>
                <div className="md:col-span-3">
                  <select
                    value={encodeRoleValue(currentValue)}
                    onChange={(e) => onChangeRole(m.id, e.target.value)}
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium"
                  >
                    <optgroup label="Built-in">
                      <option value="b:client_admin">Admin</option>
                      <option value="b:client_recruiter">Recruiter</option>
                      <option value="b:client_viewer">Viewer</option>
                    </optgroup>
                    {customRoles.length > 0 && (
                      <optgroup label="Custom">
                        {customRoles.map((r) => (
                          <option key={r.id} value={`c:${r.id}`}>{r.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div className="md:col-span-2 text-xs">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/25 capitalize">
                    {m.status}
                  </span>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    onClick={() => onRemove(m.id)}
                    className="h-8 inline-flex items-center gap-1 px-2 rounded-md text-xs text-destructive hover:bg-destructive/10"
                    title="Remove"
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} customRoles={customRoles} />
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  customRoles,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customRoles: ClientCustomRole[];
}) {
  const qc = useQueryClient();
  const inviteFn = useServerFn(inviteClientMember);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [roleSel, setRoleSel] = useState<string>("b:client_recruiter");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const v = decodeRoleValue(roleSel);
      await inviteFn({
        data: {
          email,
          fullName,
          password,
          role: v.kind === "builtin" ? v.value : undefined,
          customRoleId: v.kind === "custom" ? v.value : undefined,
        },
      });
      toast.success("Teammate invited");
      qc.invalidateQueries({ queryKey: ["client-my-team"] });
      setEmail("");
      setFullName("");
      setPassword("");
      setRoleSel("b:client_recruiter");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not invite teammate");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite teammate</DialogTitle>
          <DialogDescription>
            They'll get access to candidates and positions based on their role.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Temporary password</Label>
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <select
              value={roleSel}
              onChange={(e) => setRoleSel(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <optgroup label="Built-in">
                <option value="b:client_admin">Admin — full access</option>
                <option value="b:client_recruiter">Recruiter — source & submit candidates</option>
                <option value="b:client_viewer">Viewer — read only</option>
              </optgroup>
              {customRoles.length > 0 && (
                <optgroup label="Custom">
                  {customRoles.map((r) => (
                    <option key={r.id} value={`c:${r.id}`}>{r.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Inviting…" : "Invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Permissions Tab ----------------

function PermissionsTab() {
  const qc = useQueryClient();
  const fetchPerms = useServerFn(getClientRolePermissions);
  const updatePerms = useServerFn(updateClientRolePermissions);
  const fetchCustom = useServerFn(listClientCustomRoles);
  const createCustom = useServerFn(createClientCustomRole);
  const updateCustom = useServerFn(updateClientCustomRole);
  const deleteCustom = useServerFn(deleteClientCustomRole);

  const { data: builtin, isLoading: bLoading } = useQuery({
    queryKey: ["client-role-permissions"],
    queryFn: () => fetchPerms(),
  });
  const { data: customData, isLoading: cLoading } = useQuery({
    queryKey: ["client-custom-roles"],
    queryFn: () => fetchCustom(),
  });

  const [builtinLocal, setBuiltinLocal] = useState<Record<string, Set<string>>>({});
  const [customLocal, setCustomLocal] = useState<Record<string, { name: string; perms: Set<string> }>>({});
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!builtin) return;
    setBuiltinLocal({
      client_recruiter: new Set(builtin.rows.client_recruiter),
      client_viewer: new Set(builtin.rows.client_viewer),
    });
  }, [builtin]);

  useEffect(() => {
    if (!customData) return;
    const next: Record<string, { name: string; perms: Set<string> }> = {};
    for (const r of customData.roles) next[r.id] = { name: r.name, perms: new Set(r.permissions) };
    setCustomLocal(next);
  }, [customData]);

  function toggleBuiltin(role: string, perm: string) {
    setBuiltinLocal((prev) => {
      const next = { ...prev, [role]: new Set(prev[role] ?? []) };
      if (next[role].has(perm)) next[role].delete(perm);
      else next[role].add(perm);
      return next;
    });
  }
  function toggleCustom(id: string, perm: string) {
    setCustomLocal((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const perms = new Set(cur.perms);
      if (perms.has(perm)) perms.delete(perm);
      else perms.add(perm);
      return { ...prev, [id]: { ...cur, perms } };
    });
  }

  async function saveBuiltin(role: "client_recruiter" | "client_viewer") {
    try {
      await updatePerms({ data: { role, permissions: Array.from(builtinLocal[role] ?? []) } });
      toast.success("Permissions saved");
      qc.invalidateQueries({ queryKey: ["client-role-permissions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function saveCustom(id: string) {
    const cur = customLocal[id];
    if (!cur) return;
    try {
      await updateCustom({ data: { id, name: cur.name, permissions: Array.from(cur.perms) } });
      toast.success("Role saved");
      qc.invalidateQueries({ queryKey: ["client-custom-roles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function onDeleteCustom(id: string) {
    if (!confirm("Delete this role?")) return;
    try {
      await deleteCustom({ data: { id } });
      toast.success("Role deleted");
      qc.invalidateQueries({ queryKey: ["client-custom-roles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete role");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setCreateOpen(true)}
          className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="size-4" /> New role
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-base font-semibold">Admin</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Always has full access. Cannot be edited.
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">Locked</span>
        </div>
      </div>

      {bLoading && (
        <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
          Loading permissions…
        </div>
      )}

      {!bLoading && (["client_recruiter", "client_viewer"] as const).map((r) => {
        const set = builtinLocal[r] ?? new Set<string>();
        return (
          <PermissionCard
            key={r}
            title={builtinLabel[r]}
            subtitle={r === "client_recruiter" ? "Sources and submits candidates." : "Read-only access."}
            permsSet={set}
            onToggle={(p) => toggleBuiltin(r, p)}
            onSave={() => saveBuiltin(r)}
          />
        );
      })}

      <div className="pt-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
          Custom roles
        </div>
        {cLoading && (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading…
          </div>
        )}
        {!cLoading && Object.keys(customLocal).length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground text-center">
            No custom roles yet. Click "New role" to create one tailored to your team.
          </div>
        )}
        {Object.entries(customLocal).map(([id, r]) => (
          <div key={id} className="mt-3">
            <PermissionCard
              title={
                <input
                  value={r.name}
                  onChange={(e) =>
                    setCustomLocal((prev) => ({ ...prev, [id]: { ...prev[id], name: e.target.value } }))
                  }
                  className="bg-transparent border-b border-dashed border-border focus:outline-none focus:border-primary text-base font-semibold w-56"
                />
              }
              subtitle="Custom role · rename, change permissions, or delete."
              permsSet={r.perms}
              onToggle={(p) => toggleCustom(id, p)}
              onSave={() => saveCustom(id)}
              onDelete={() => onDeleteCustom(id)}
              renameIcon
            />
          </div>
        ))}
      </div>

      <CreateRoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (name, perms) => {
          try {
            await createCustom({ data: { name, permissions: perms } });
            toast.success("Role created");
            qc.invalidateQueries({ queryKey: ["client-custom-roles"] });
            setCreateOpen(false);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not create role");
          }
        }}
      />
    </div>
  );
}

function PermissionCard({
  title,
  subtitle,
  permsSet,
  onToggle,
  onSave,
  onDelete,
  renameIcon,
}: {
  title: React.ReactNode;
  subtitle: string;
  permsSet: Set<string>;
  onToggle: (p: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  renameIcon?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-base font-semibold inline-flex items-center gap-1.5">
            {renameIcon && <Pencil className="size-3.5 text-muted-foreground" />}
            {title}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md border border-border text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          )}
          <button
            onClick={onSave}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
          >
            <Save className="size-3.5" /> Save
          </button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {CLIENT_PERMISSIONS.map((p) => (
          <label
            key={p}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-secondary/40"
          >
            <Checkbox checked={permsSet.has(p)} onCheckedChange={() => onToggle(p)} />
            <span>{permLabel(p)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CreateRoleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (name: string, perms: string[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setPerms(new Set());
    }
  }, [open]);

  function toggle(p: string) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onCreated(name.trim(), Array.from(perms));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create custom role</DialogTitle>
          <DialogDescription>
            Define a role name and pick the permissions it should have.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Role name</Label>
            <Input
              required
              maxLength={64}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sourcer, Coordinator"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Permissions</Label>
            <div className="grid sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {CLIENT_PERMISSIONS.map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-secondary/40"
                >
                  <Checkbox checked={perms.has(p)} onCheckedChange={() => toggle(p)} />
                  <span>{permLabel(p)}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create role"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}