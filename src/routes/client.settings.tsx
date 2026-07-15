import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, KeyRound, LogOut } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { GoogleCalendarCard } from "@/components/google-calendar-card";

export const Route = createFileRoute("/client/settings")({
  ssr: false,
  component: () => (
    <ClientShell>
      <ClientSettingsInner />
    </ClientShell>
  ),
});

function ClientSettingsInner() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg({ kind: "err", text: "Password must be at least 8 characters." });
    if (pw !== pw2) return setMsg({ kind: "err", text: "Passwords do not match." });
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) setMsg({ kind: "err", text: error.message });
    else {
      setMsg({ kind: "ok", text: "Password updated." });
      setPw(""); setPw2("");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Account security, integrations, and session.</p>
      </div>

      <GoogleCalendarCard description="Optional — connect Google so interviews you request auto-generate a Meet link and email invites to everyone. You can also skip this and paste meeting links manually when scheduling." />

      <form onSubmit={changePassword} className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Change password</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">New password</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="mt-1 w-full h-10 rounded-md bg-background border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Confirm</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="mt-1 w-full h-10 rounded-md bg-background border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </div>
        {msg && <div className={cn("text-xs", msg.kind === "ok" ? "text-success" : "text-destructive")}>{msg.text}</div>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !pw}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />} Update password
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Session</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Sign out from this device.</p>
        </div>
        <button
          onClick={async () => { await signOut(); navigate({ to: "/client/login", replace: true }); }}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary/60"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </div>
  );
}