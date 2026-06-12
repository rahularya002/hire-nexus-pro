import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users2, Plus, ShieldCheck, Trash2, Mail } from "lucide-react";
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
import { toast } from "sonner";
import {
  listClientMembers,
  inviteClientMember,
  updateClientMemberRole,
  removeClientMember,
  type ClientMemberRole,
} from "@/lib/client-team.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/my-team")({
  component: () => (
    <ClientShell>
      <Page />
    </ClientShell>
  ),
});

const roleLabel: Record<ClientMemberRole, string> = {
  client_admin: "Admin",
  client_recruiter: "Recruiter",
  client_viewer: "Viewer",
};

const roleTone: Record<ClientMemberRole, string> = {
  client_admin: "bg-primary/15 text-primary border-primary/25",
  client_recruiter: "bg-info/15 text-info border-info/25",
  client_viewer: "bg-muted text-muted-foreground border-border",
};

function Page() {
  const qc = useQueryClient();
  const fetchMembers = useServerFn(listClientMembers);
  const updateRoleFn = useServerFn(updateClientMemberRole);
  const removeFn = useServerFn(removeClientMember);
  const { data, isLoading } = useQuery({
    queryKey: ["client-my-team"],
    queryFn: () => fetchMembers(),
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const members = data?.members ?? [];

  async function onChangeRole(memberId: string, role: ClientMemberRole) {
    try {
      await updateRoleFn({ data: { memberId, role } });
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
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Your in-house recruiters
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1 inline-flex items-center gap-2">
            <Users2 className="size-5 text-primary" /> My Team
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite teammates so they can source, screen, and submit candidates for your self-managed roles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/client/my-team/permissions"
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary"
          >
            <ShieldCheck className="size-4" /> Roles & Permissions
          </Link>
          <button
            onClick={() => setInviteOpen(true)}
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="size-4" /> Invite teammate
          </button>
        </div>
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
                    value={m.role}
                    onChange={(e) => onChangeRole(m.id, e.target.value as ClientMemberRole)}
                    className={cn(
                      "h-8 rounded-md border px-2 text-xs font-medium",
                      roleTone[m.role],
                    )}
                  >
                    <option value="client_admin">Admin</option>
                    <option value="client_recruiter">Recruiter</option>
                    <option value="client_viewer">Viewer</option>
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

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const inviteFn = useServerFn(inviteClientMember);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ClientMemberRole>("client_recruiter");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await inviteFn({ data: { email, fullName, password, role } });
      toast.success("Teammate invited");
      qc.invalidateQueries({ queryKey: ["client-my-team"] });
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("client_recruiter");
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
              value={role}
              onChange={(e) => setRole(e.target.value as ClientMemberRole)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="client_admin">Admin — full access</option>
              <option value="client_recruiter">Recruiter — source & submit candidates</option>
              <option value="client_viewer">Viewer — read only</option>
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