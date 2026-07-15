import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Check, X, Loader2 } from "lucide-react";
import {
  getMyGoogleConnection,
  startGoogleOAuth,
  disconnectGoogle,
} from "@/lib/google-calendar.functions";
import { resyncPendingInterviews } from "@/lib/interviews.functions";
import { toast } from "sonner";

export function GoogleCalendarCard({ description }: { description?: string }) {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getMyGoogleConnection);
  const startFn = useServerFn(startGoogleOAuth);
  const disconnectFn = useServerFn(disconnectGoogle);
  const resyncFn = useServerFn(resyncPendingInterviews);

  const { data, isLoading } = useQuery({
    queryKey: ["google-connection"],
    queryFn: () => fetchStatus(),
  });

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "google-oauth") {
        qc.invalidateQueries({ queryKey: ["google-connection"] });
        // Backfill Meet links for any interviews requested before connecting.
        resyncFn()
          .then((r) => {
            if (r?.synced) {
              toast.success(`Generated Meet links for ${r.synced} interview${r.synced === 1 ? "" : "s"}.`);
              qc.invalidateQueries({ queryKey: ["client-interviews"] });
              qc.invalidateQueries({ queryKey: ["staff-interviews"] });
              qc.invalidateQueries({ queryKey: ["interviews"] });
            }
          })
          .catch(() => {});
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [qc, resyncFn]);

  const connect = async () => {
    setBusy(true);
    try {
      const { authUrl } = await startFn({ data: { origin: window.location.origin } });
      try { sessionStorage.setItem("google-oauth-return", window.location.pathname); } catch {}
      window.location.href = authUrl;
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
        {description ??
          "Optional — connect Google so interviews you schedule auto-generate a Meet link and email invites to the candidate. You can also skip this and paste meeting links manually when scheduling."}
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
          className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />} Connect Google Calendar
        </button>
      )}
    </div>
  );
}