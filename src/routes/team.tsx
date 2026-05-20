import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { recruiters, type RecruiterStatus } from "@/lib/ops/store";
import { Users, TrendingUp, Activity, Coffee, CircleOff, UserPlus, Shield, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { inviteTeamMember } from "@/lib/team.functions";

export const Route = createFileRoute("/team")({ component: TeamPage });

function statusMeta(s: RecruiterStatus) {
  if (s === "Active") return { dot: "bg-success", label: "Active", Icon: Activity, cls: "text-success" };
  if (s === "Available") return { dot: "bg-info", label: "Available", Icon: Users, cls: "text-info" };
  if (s === "Break") return { dot: "bg-warning", label: "Break", Icon: Coffee, cls: "text-warning" };
  return { dot: "bg-muted-foreground", label: "Offline", Icon: CircleOff, cls: "text-muted-foreground" };
}

const ALL_PERMISSIONS = [
  { key: "candidates.view", label: "View candidates", group: "Candidates" },
  { key: "candidates.edit", label: "Edit candidates", group: "Candidates" },
  { key: "candidates.delete", label: "Delete candidates", group: "Candidates" },
  { key: "positions.view", label: "View positions", group: "Positions" },
  { key: "positions.create", label: "Create positions", group: "Positions" },
  { key: "positions.assign", label: "Assign recruiters", group: "Positions" },
  { key: "clients.view", label: "View clients", group: "Clients" },
  { key: "clients.manage", label: "Manage clients", group: "Clients" },
  { key: "pipeline.share", label: "Share to client", group: "Pipeline" },
  { key: "pipeline.move", label: "Move stages", group: "Pipeline" },
  { key: "team.view", label: "View team", group: "Team" },
  { key: "team.invite", label: "Invite recruiters", group: "Team" },
  { key: "roles.manage", label: "Manage roles & permissions", group: "Admin" },
  { key: "billing.manage", label: "Manage billing", group: "Admin" },
] as const;

type PermKey = (typeof ALL_PERMISSIONS)[number]["key"];
type Role = { id: string; name: string; description: string; system: boolean; permissions: PermKey[] };

const DEFAULT_ROLES: Role[] = [
  { id: "admin", name: "Admin", description: "Full access to everything.", system: true, permissions: ALL_PERMISSIONS.map((p) => p.key) },
  { id: "lead", name: "Lead Recruiter", description: "Leads a desk; manages positions, pipeline and team.", system: true, permissions: ["candidates.view","candidates.edit","positions.view","positions.create","positions.assign","clients.view","clients.manage","pipeline.share","pipeline.move","team.view","team.invite"] },
  { id: "senior", name: "Senior Recruiter", description: "Owns positions and shares to clients.", system: true, permissions: ["candidates.view","candidates.edit","positions.view","positions.create","clients.view","pipeline.share","pipeline.move","team.view"] },
  { id: "recruiter", name: "Recruiter", description: "Standard recruiter access.", system: true, permissions: ["candidates.view","candidates.edit","positions.view","clients.view","pipeline.move","team.view"] },
];

function TeamPage() {
  const [team, setTeam] = useState(() => [...recruiters]);
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [addOpen, setAddOpen] = useState(false);

  const summary = useMemo(() => ({
    online: team.filter((r) => r.status !== "Offline").length,
    active: team.filter((r) => r.status === "Active").length,
    sharesToday: team.reduce((s, r) => s + r.sharesToday, 0),
    closuresMtd: team.reduce((s, r) => s + r.closuresMtd, 0),
    avgConv: team.length ? Math.round(team.reduce((s, r) => s + r.conversionPct, 0) / team.length) : 0,
  }), [team]);

  function addRecruiter(data: { name: string; role: string; status: RecruiterStatus }) {
    const initials = data.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "??";
    const id = `r${Date.now()}`;
    setTeam((t) => [
      ...t,
      { id, name: data.name, initials, role: data.role, status: data.status, loginAt: "—", assignedClients: 0, assignedPositions: 0, sharesToday: 0, closuresMtd: 0, conversionPct: 0, joinedOn: new Date().toLocaleString("en-US",{month:"short",year:"numeric"}) },
    ]);
    toast.success(`${data.name} added to the team`);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Operations</div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
              <Users className="size-5 text-primary" /> Recruiter roster
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Live activity, attendance and productivity across the desk.</p>
          </div>
          <AddRecruiterDialog open={addOpen} onOpenChange={setAddOpen} roles={roles} onAdd={addRecruiter} />
        </div>

        <Tabs defaultValue="roster" className="space-y-6">
          <TabsList>
            <TabsTrigger value="roster"><Users className="size-3.5 mr-1.5" />Roster</TabsTrigger>
            <TabsTrigger value="roles"><Shield className="size-3.5 mr-1.5" />Roles & Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="roster" className="space-y-6 mt-0">

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Online", value: summary.online },
            { label: "Actively working", value: summary.active },
            { label: "Shares today", value: summary.sharesToday },
            { label: "Closures MTD", value: summary.closuresMtd },
            { label: "Avg. conversion", value: `${summary.avgConv}%` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Recruiter</th>
                  <th className="text-left font-medium px-2 py-2.5">Status</th>
                  <th className="text-left font-medium px-2 py-2.5">Login</th>
                  <th className="text-right font-medium px-2 py-2.5">Clients</th>
                  <th className="text-right font-medium px-2 py-2.5">Positions</th>
                  <th className="text-right font-medium px-2 py-2.5">Shares today</th>
                  <th className="text-right font-medium px-2 py-2.5">Closures MTD</th>
                  <th className="text-right font-medium px-4 py-2.5">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {team.map((r) => {
                  const m = statusMeta(r.status);
                  return (
                    <tr key={r.id} className="hover:bg-secondary/30 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-gradient-to-br from-primary/30 to-purple/30 grid place-items-center text-xs font-semibold">
                            {r.initials}
                          </div>
                          <div className="leading-tight">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-[11px] text-muted-foreground">{r.role} · joined {r.joinedOn}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", m.cls)}>
                          <span className={cn("size-1.5 rounded-full", m.dot, r.status === "Active" && "animate-pulse")} />
                          {m.label}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-xs text-muted-foreground tabular-nums">{r.loginAt}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{r.assignedClients}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{r.assignedPositions}</td>
                      <td className="px-2 py-3 text-right tabular-nums font-medium">{r.sharesToday}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{r.closuresMtd}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 tabular-nums font-semibold text-success">
                          <TrendingUp className="size-3" />{r.conversionPct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="roles" className="mt-0">
            <RolesPanel roles={roles} setRoles={setRoles} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function AddRecruiterDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (b: boolean) => void; roles: Role[]; onAdd: (d: { name: string; role: string; status: RecruiterStatus }) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"recruiter" | "admin">("recruiter");
  const [submitting, setSubmitting] = useState(false);
  const invite = useServerFn(inviteTeamMember);

  async function submit() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!email.trim()) { toast.error("Email is required"); return; }
    setSubmitting(true);
    try {
      await invite({ data: { email: email.trim(), fullName: name.trim(), role } });
      toast.success(`Invite sent to ${email}`);
      // Reflect locally so the roster shows the new teammate immediately.
      onAdd({ name: name.trim(), role: role === "admin" ? "Admin" : "Recruiter", status: "Offline" });
      setName(""); setEmail(""); setRole("recruiter");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send invite");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><UserPlus className="size-4 mr-1.5" />Invite teammate</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite teammate</DialogTitle>
          <DialogDescription>
            We'll email them an invite link. They'll set their own password on first sign-in — no password needed here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rn">Full name</Label>
            <Input id="rn" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anika Verma" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="re">Work email</Label>
            <Input id="re" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anika@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "recruiter" | "admin")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recruiter">Recruiter</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Sending…" : "Send invite"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesPanel({ roles, setRoles }: { roles: Role[]; setRoles: React.Dispatch<React.SetStateAction<Role[]>> }) {
  const [selectedId, setSelectedId] = useState(roles[0]?.id);
  const [createOpen, setCreateOpen] = useState(false);
  const selected = roles.find((r) => r.id === selectedId) ?? roles[0];

  const grouped = useMemo(() => {
    const m = new Map<string, typeof ALL_PERMISSIONS[number][]>();
    ALL_PERMISSIONS.forEach((p) => {
      const arr = m.get(p.group) ?? [];
      arr.push(p);
      m.set(p.group, arr);
    });
    return [...m.entries()];
  }, []);

  function toggle(perm: PermKey, on: boolean) {
    if (!selected) return;
    setRoles((rs) => rs.map((r) => r.id !== selected.id ? r : {
      ...r,
      permissions: on ? [...new Set([...r.permissions, perm])] : r.permissions.filter((p) => p !== perm),
    }));
  }

  function deleteRole(id: string) {
    const r = roles.find((x) => x.id === id);
    if (!r || r.system) return;
    setRoles((rs) => rs.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(roles[0]?.id);
    toast.success(`Removed role "${r.name}"`);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="text-sm font-medium">Roles</div>
          <CreateRoleDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={(name, desc) => {
            const id = `role-${Date.now()}`;
            setRoles((rs) => [...rs, { id, name, description: desc, system: false, permissions: [] }]);
            setSelectedId(id);
            toast.success(`Role "${name}" created`);
          }} />
        </div>
        <ul className="divide-y divide-border">
          {roles.map((r) => (
            <li key={r.id}>
              <button onClick={() => setSelectedId(r.id)} className={cn("w-full text-left px-4 py-3 flex items-start justify-between gap-2 hover:bg-secondary/40 transition", selected?.id === r.id && "bg-secondary/60")}>
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {r.name}
                    {r.system ? <Badge variant="secondary" className="text-[10px]">System</Badge> : <Badge className="text-[10px]">Custom</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{r.permissions.length} permissions</div>
                </div>
                {!r.system && (
                  <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); deleteRole(r.id); }} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="size-3.5" />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {selected ? (
          <>
            <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold flex items-center gap-2">
                  <Shield className="size-4 text-primary" />{selected.name}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{selected.description}</p>
              </div>
              <Badge variant="outline">{selected.permissions.length} / {ALL_PERMISSIONS.length}</Badge>
            </div>
            <div className="p-5 space-y-5">
              {grouped.map(([group, perms]) => (
                <div key={group}>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">{group}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {perms.map((p) => {
                      const on = selected.permissions.includes(p.key);
                      const disabled = selected.system && selected.id === "admin";
                      return (
                        <label key={p.key} className={cn("flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-secondary/40 transition", on && "bg-secondary/40", disabled && "opacity-60 cursor-not-allowed")}>
                          <Checkbox checked={on} disabled={disabled} onCheckedChange={(v) => toggle(p.key, !!v)} />
                          <span className="flex-1">{p.label}</span>
                          <code className="text-[10px] text-muted-foreground">{p.key}</code>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="p-10 text-center text-sm text-muted-foreground">Select a role to manage permissions.</div>
        )}
      </div>
    </div>
  );
}

function CreateRoleDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (b: boolean) => void; onCreate: (name: string, desc: string) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="size-3.5 mr-1" />New role</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create custom role</DialogTitle>
          <DialogDescription>Define a new role and assign permissions next.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rname">Role name</Label>
            <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sourcing Specialist" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rdesc">Description</Label>
            <Input id="rdesc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this role can do" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => {
            if (!name.trim()) { toast.error("Name is required"); return; }
            onCreate(name.trim(), desc.trim() || "Custom role");
            setName(""); setDesc(""); onOpenChange(false);
          }}>Create role</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}