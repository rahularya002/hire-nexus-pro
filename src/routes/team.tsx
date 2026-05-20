import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { recruiters, type RecruiterStatus } from "@/lib/ops/store";
import { Users, TrendingUp, Activity, Coffee, CircleOff, UserPlus, Shield, Copy, Eye, EyeOff, RefreshCw, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
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
import { createTeamMember, getRolePermissions, updateRolePermissions } from "@/lib/team.functions";
import { useAuth } from "@/lib/auth/auth-context";

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
type DbRole = "admin" | "lead_recruiter" | "senior_recruiter" | "recruiter" | "client";
type Role = { id: DbRole; name: string; description: string; permissions: string[] };

const ROLE_META: Record<DbRole, { name: string; description: string }> = {
  admin: { name: "Admin", description: "Full access to everything." },
  lead_recruiter: { name: "Lead Recruiter", description: "Leads a desk; manages positions, pipeline and team." },
  senior_recruiter: { name: "Senior Recruiter", description: "Owns positions and shares to clients." },
  recruiter: { name: "Recruiter", description: "Standard recruiter access." },
  client: { name: "Client", description: "External client portal access." },
};
const ROLE_ORDER: DbRole[] = ["admin", "lead_recruiter", "senior_recruiter", "recruiter", "client"];
const TEAM_ROLE_OPTIONS: { value: Exclude<DbRole, "client">; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "lead_recruiter", label: "Lead Recruiter" },
  { value: "senior_recruiter", label: "Senior Recruiter" },
  { value: "recruiter", label: "Recruiter" },
];

function TeamPage() {
  const [team, setTeam] = useState(() => [...recruiters]);
  const [addOpen, setAddOpen] = useState(false);
  const { can, roles: myRoles } = useAuth();
  const isAdmin = myRoles.includes("admin");

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
          {isAdmin && <AddRecruiterDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addRecruiter} />}
        </div>

        <Tabs defaultValue="roster" className="space-y-6">
          <TabsList>
            <TabsTrigger value="roster"><Users className="size-3.5 mr-1.5" />Roster</TabsTrigger>
            {can("roles.manage") && (
              <TabsTrigger value="roles"><Shield className="size-3.5 mr-1.5" />Roles & Permissions</TabsTrigger>
            )}
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

          {can("roles.manage") && (
            <TabsContent value="roles" className="mt-0">
              <RolesPanel />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppShell>
  );
}

function generatePassword(length = 14): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(length);
  (typeof crypto !== "undefined" ? crypto : ({ getRandomValues: (a: Uint32Array) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 0xffffffff); return a; } } as Crypto)).getRandomValues(arr);
  for (let i = 0; i < length; i++) out += charset[arr[i] % charset.length];
  return out;
}

type CreatedCreds = { email: string; password: string };

function AddRecruiterDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (b: boolean) => void; onAdd: (d: { name: string; role: string; status: RecruiterStatus }) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<Exclude<DbRole, "client">>("recruiter");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedCreds | null>(null);
  const create = useServerFn(createTeamMember);

  function reset() {
    setName(""); setEmail(""); setPassword(generatePassword()); setRole("recruiter"); setShowPw(false); setCreated(null);
  }

  async function submit() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!email.trim()) { toast.error("Email is required"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setSubmitting(true);
    try {
      await create({ data: { email: email.trim(), password, fullName: name.trim(), role } });
      onAdd({ name: name.trim(), role: ROLE_META[role].name, status: "Offline" });
      setCreated({ email: email.trim(), password });
      toast.success("Account created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
  }

  return (
    <Dialog open={open} onOpenChange={(b) => { if (!b) reset(); onOpenChange(b); }}>
      <DialogTrigger asChild>
        <Button><UserPlus className="size-4 mr-1.5" />Add teammate</Button>
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Account ready</DialogTitle>
              <DialogDescription>Share these credentials with your teammate. They can sign in right away.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-secondary/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">Email</div>
                  <Button size="sm" variant="ghost" onClick={() => copy(created.email, "Email")}><Copy className="size-3.5" /></Button>
                </div>
                <div className="font-mono text-sm break-all">{created.email}</div>
              </div>
              <div className="rounded-md border border-border bg-secondary/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">Password</div>
                  <Button size="sm" variant="ghost" onClick={() => copy(created.password, "Password")}><Copy className="size-3.5" /></Button>
                </div>
                <div className="font-mono text-sm break-all">{created.password}</div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => copy(`Email: ${created.email}\nPassword: ${created.password}`, "Credentials")}
              >
                <Copy className="size-4 mr-1.5" /> Copy both
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add teammate</DialogTitle>
              <DialogDescription>Create an account directly. You'll get the credentials to share — no email required.</DialogDescription>
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
                <Label htmlFor="rp">Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input id="rp" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-9 font-mono" />
                    <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={() => { setPassword(generatePassword()); setShowPw(true); }} title="Generate new password">
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">At least 8 characters. You'll be shown the password after creating.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Exclude<DbRole, "client">)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEAM_ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? "Creating…" : "Create account"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RolesPanel() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<DbRole>("admin");
  const loadRoles = useServerFn(getRolePermissions);
  const saveRole = useServerFn(updateRolePermissions);

  useEffect(() => {
    loadRoles({})
      .then((res) => {
        const map = new Map(res.rows.map((r) => [r.role as DbRole, r.permissions]));
        const built = ROLE_ORDER.map<Role>((r) => ({
          id: r,
          name: ROLE_META[r].name,
          description: ROLE_META[r].description,
          permissions: map.get(r) ?? [],
        }));
        setRoles(built);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load roles"))
      .finally(() => setLoading(false));
  }, [loadRoles]);

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

  async function toggle(perm: PermKey, on: boolean) {
    if (!selected || selected.id === "admin") return;
    const next = on
      ? [...new Set([...selected.permissions, perm])]
      : selected.permissions.filter((p) => p !== perm);
    const prev = selected.permissions;
    setRoles((rs) => rs.map((r) => (r.id === selected.id ? { ...r, permissions: next } : r)));
    setSaving(true);
    try {
      await saveRole({ data: { role: selected.id, permissions: next } });
    } catch (e) {
      setRoles((rs) => rs.map((r) => (r.id === selected.id ? { ...r, permissions: prev } : r)));
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading roles…</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="text-sm font-medium">Roles</div>
          {saving && <span className="text-[11px] text-muted-foreground">Saving…</span>}
        </div>
        <ul className="divide-y divide-border">
          {roles.map((r) => (
            <li key={r.id}>
              <button onClick={() => setSelectedId(r.id)} className={cn("w-full text-left px-4 py-3 flex items-start justify-between gap-2 hover:bg-secondary/40 transition", selected?.id === r.id && "bg-secondary/60")}>
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {r.name}
                    {r.id === "admin" && <Badge variant="secondary" className="text-[10px]"><Lock className="size-2.5 mr-0.5" />Locked</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{r.permissions.length} permissions</div>
                </div>
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
                      const disabled = selected.id === "admin";
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
