import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, KeyRound, LogOut, Calendar, Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  getMyGoogleConnection,
  startGoogleOAuth,
  disconnectGoogle,
} from "@/lib/google-calendar.functions";

export const Route = createFileRoute("/settings")({
  ssr: false,
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell>
      <SettingsInner />
    </AppShell>
  );
}

function SettingsInner() {
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
        <p className="text-sm text-muted-foreground mt-1">Account security and session.</p>
      </div>

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

      <GoogleCalendarCard />

      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Session</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Sign out from this device.</p>
        </div>
        <button
          onClick={async () => { await signOut(); navigate({ to: "/login", replace: true }); }}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary/60"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

function GoogleCalendarCard() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getMyGoogleConnection);
  const startFn = useServerFn(startGoogleOAuth);
  const disconnectFn = useServerFn(disconnectGoogle);

  const { data, isLoading } = useQuery({
    queryKey: ["google-connection"],
    queryFn: () => fetchStatus(),
  });

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "google-oauth") {
        qc.invalidateQueries({ queryKey: ["google-connection"] });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [qc]);

  const connect = async () => {
    setBusy(true);
    try {
      const { authUrl } = await startFn({ data: { origin: window.location.origin } });
      const w = 520, h = 640;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      const popup = window.open(authUrl, "google-oauth", `width=${w},height=${h},left=${left},top=${top}`);
      if (!popup) window.location.href = authUrl;
      // poll for popup close → refresh
      const t = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(t);
          qc.invalidateQueries({ queryKey: ["google-connection"] });
        }
      }, 800);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["google-connection"] }),
  });

  const connected = !!data?.connected;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Google Calendar &amp; Meet</h2>
        {connected ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/25">
            <Check className="size-3" /> Connected
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            <X className="size-3" /> Not connected
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Connect your Google account so interviews you schedule auto-create a calendar event with a Google Meet link and email invites to the candidate.
      </p>
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : connected ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs">
            Signed in as <span className="font-medium">{data?.google_email}</span>
          </div>
          <button
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="h-9 px-3 rounded-md border border-border text-xs font-medium hover:bg-secondary inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {disconnect.isPending && <Loader2 className="size-3.5 animate-spin" />} Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={connect}
          disabled={busy}
          className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />} Connect Google Calendar
        </button>
      )}
    </div>
  );
}