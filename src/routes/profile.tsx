import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  ssr: false,
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <AppShell>
      <ProfileInner />
    </AppShell>
  );
}

function ProfileInner() {
  const { profile, user, roles, refresh } = useAuth();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [credSaving, setCredSaving] = useState(false);
  const [credMsg, setCredMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const isAdmin = roles.includes("admin");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setCompanyName(profile?.company_name ?? "");
    setEmail(profile?.email ?? user?.email ?? "");
  }, [profile?.full_name, profile?.company_name, profile?.email, user?.email]);

  const initials = (profile?.full_name || profile?.email || "?")
    .split(/[\s@]+/).filter(Boolean).map((p) => p[0]!).join("").slice(0, 2).toUpperCase();
  const primaryRole = roles[0] ?? "user";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName || null, company_name: companyName || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) setMsg({ kind: "err", text: error.message });
    else {
      setMsg({ kind: "ok", text: "Profile updated." });
      await refresh();
    }
  };

  const saveCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredMsg(null);
    const payload: { email?: string; password?: string } = {};
    if (email && email !== (profile?.email ?? user?.email)) payload.email = email;
    if (password) payload.password = password;
    if (!payload.email && !payload.password) {
      setCredMsg({ kind: "err", text: "Nothing to update." });
      return;
    }
    setCredSaving(true);
    const { error } = await supabase.auth.updateUser(payload);
    setCredSaving(false);
    if (error) {
      setCredMsg({ kind: "err", text: error.message });
      return;
    }
    setPassword("");
    if (payload.email) {
      // Mirror onto profiles for consistency in our app UI.
      if (user) await supabase.from("profiles").update({ email: payload.email }).eq("id", user.id);
      await refresh();
      setCredMsg({ kind: "ok", text: "Updated. If email confirmation is on, check both inboxes to confirm." });
    } else {
      setCredMsg({ kind: "ok", text: "Password updated." });
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal account information.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="size-14 rounded-full bg-gradient-to-br from-primary to-purple text-primary-foreground grid place-items-center text-lg font-semibold">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-medium truncate">{profile?.full_name || profile?.email || "Account"}</div>
          <div className="text-sm text-muted-foreground truncate">{profile?.email}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded bg-secondary text-foreground capitalize">{primaryRole.replace(/_/g, " ")}</span>
            <span className={cn(
              "inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded capitalize",
              profile?.status === "active" && "bg-success/15 text-success",
              profile?.status === "pending" && "bg-warning/15 text-warning",
              profile?.status === "rejected" && "bg-destructive/15 text-destructive",
            )}>{profile?.status ?? "—"}</span>
          </div>
        </div>
      </div>

      <form onSubmit={save} className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Edit profile</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full h-10 rounded-md bg-background border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Company</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1 w-full h-10 rounded-md bg-background border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </div>
        {msg && (
          <div className={cn("text-xs", msg.kind === "ok" ? "text-success" : "text-destructive")}>{msg.text}</div>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes
          </button>
        </div>
      </form>

      {isAdmin && (
        <form onSubmit={saveCreds} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Login credentials</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Admin-only. Update your sign-in email or password.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-10 rounded-md bg-background border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">New password</label>
              <input
                type="text"
                value={password}
                placeholder="Leave blank to keep current"
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full h-10 rounded-md bg-background border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>
          {credMsg && (
            <div className={cn("text-xs", credMsg.kind === "ok" ? "text-success" : "text-destructive")}>{credMsg.text}</div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={credSaving}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {credSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Update credentials
            </button>
          </div>
        </form>
      )}
    </div>
  );
}