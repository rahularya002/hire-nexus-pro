import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Phone, PhoneOff, Loader2, Sparkles, Save, CheckCircle2, Bug } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  getScreenerForPosition,
  saveScreener,
  createTestCallToken,
  getConversationDebug,
} from "@/lib/ai-screener.functions";
import { cn } from "@/lib/utils";

export function AiScreenerCard({ positionId }: { positionId: string }) {
  return (
    <ConversationProvider>
      <AiScreenerCardInner positionId={positionId} />
    </ConversationProvider>
  );
}

function AiScreenerCardInner({ positionId }: { positionId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getScreenerForPosition);
  const saveFn = useServerFn(saveScreener);
  const tokenFn = useServerFn(createTestCallToken);
  const debugFn = useServerFn(getConversationDebug);

  const q = useQuery({
    queryKey: ["ai-screener", positionId],
    queryFn: () => getFn({ data: { positionId } }),
  });

  const [enabled, setEnabled] = useState(false);
  const [pitch, setPitch] = useState("");
  const [askNoticeCtc, setAskNoticeCtc] = useState(true);
  const [askLocation, setAskLocation] = useState(true);
  const [askSkills, setAskSkills] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const pendingContextRef = useRef<string | null>(null);
  const [lastConvId, setLastConvId] = useState<string | null>(null);
  const [debugging, setDebugging] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    setEnabled(q.data.screener.enabled);
    setPitch(q.data.screener.jobPitch);
    setAskNoticeCtc(q.data.screener.askNoticeCtc);
    setAskLocation(q.data.screener.askLocation);
    setAskSkills(q.data.screener.askSkills);
  }, [q.data]);

  const conversation = useConversation({
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : typeof err === "string" ? err : "Call error";
      console.error("[ai-screener] onError", err);
      toast.error(message);
    },
    onConnect: (payload) => {
      console.info("[ai-screener] onConnect", payload);
      try {
        const id = conversation.getId?.();
        if (id) setLastConvId(id);
      } catch { /* ignore */ }
    },
    onDisconnect: (payload) => {
      console.warn("[ai-screener] onDisconnect", payload);
    },
    onDebug: (evt) => {
      console.info("[ai-screener] debug", evt);
    },
    onMessage: (msg) => {
      console.info("[ai-screener] message", msg);
      // Send the role brief only once the server confirms init.
      if ((msg as { type?: string }).type === "conversation_initiation_metadata") {
        const ctx = pendingContextRef.current;
        if (ctx) {
          try {
            conversation.sendContextualUpdate(ctx);
          } catch (e) {
            console.warn("[ai-screener] sendContextualUpdate failed", e);
          }
          pendingContextRef.current = null;
        }
      }
    },
  });

  const status = conversation.status; // 'connected' | 'connecting' | 'disconnected'
  const isLive = status === "connected";

  async function persist(next?: Partial<{ enabled: boolean }>) {
    setSaving(true);
    try {
      await saveFn({
        data: {
          positionId,
          enabled: next?.enabled ?? enabled,
          jobPitch: pitch,
          askNoticeCtc,
          askLocation,
          askSkills,
        },
      });
      qc.invalidateQueries({ queryKey: ["ai-screener", positionId] });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function startTestCall() {
    if (isLive) {
      await conversation.endSession();
      return;
    }
    setConnecting(true);
    try {
      // save latest draft so token uses current script
      await saveFn({
        data: {
          positionId,
          enabled,
          jobPitch: pitch,
          askNoticeCtc,
          askLocation,
          askSkills,
        },
      });
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const t = await tokenFn({ data: { positionId } });
      pendingContextRef.current = [
        `Role brief for this test call:`,
        t.systemPrompt,
        ``,
        `Suggested opening line: ${t.firstMessage}`,
      ].join("\n");
      await conversation.startSession({
        conversationToken: t.token,
        connectionType: "webrtc",
        dynamicVariables: t.dynamicVariables,
      });
      try {
        const id = conversation.getId?.();
        if (id) setLastConvId(id);
      } catch { /* ignore */ }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start test call");
    } finally {
      setConnecting(false);
    }
  }

  async function debugLastCall() {
    if (!lastConvId) {
      toast.error("No recent call ID yet — start a test call first.");
      return;
    }
    setDebugging(true);
    try {
      // give ElevenLabs a moment to finalize the record
      await new Promise((r) => setTimeout(r, 1500));
      const info = await debugFn({ data: { conversationId: lastConvId } });
      console.info("[ai-screener] conversation debug", info);
      const reason = info.terminationReason || info.status || "unknown";
      toast.message(`Call ended: ${reason}`, {
        description: `Duration ${info.callDuration ?? 0}s. Full payload in console.`,
      });
    } catch (e) {
      console.error("[ai-screener] debug fetch failed", e);
      toast.error(e instanceof Error ? e.message : "Debug fetch failed");
    } finally {
      setDebugging(false);
    }
  }

  if (q.isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 h-40 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (q.error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Couldn't load AI screener: {q.error instanceof Error ? q.error.message : "unknown error"}
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border bg-card p-5 space-y-4 transition", enabled ? "border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]" : "border-border")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm">Enable automated calling</div>
            <div className="text-xs text-muted-foreground truncate">AI first-screening call for candidates on this role.</div>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => {
            setEnabled(v);
            persist({ enabled: v });
          }}
        />
      </div>

      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1.5">Job pitch</div>
        <textarea
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 focus:bg-background"
          placeholder="Hello! This is a call from our hiring team..."
        />
      </div>

      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1.5">
          We'll also ask screening questions to make sure you get matching candidates
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { k: "ctc", label: "Notice period & current CTC", v: askNoticeCtc, set: setAskNoticeCtc },
            { k: "loc", label: "Location / relocation", v: askLocation, set: setAskLocation },
            { k: "skills", label: "Key skills confirmation", v: askSkills, set: setAskSkills },
          ].map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => o.set(!o.v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                o.v
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {o.v && <CheckCircle2 className="size-3 text-primary" />}
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="text-xs text-muted-foreground min-h-4">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              {conversation.isSpeaking ? "Agent speaking…" : "Listening…"}
            </span>
          ) : connecting || status === "connecting" ? (
            "Connecting…"
          ) : (
            "Tip: hit test call to try the flow in your browser."
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => persist()} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save
          </Button>
          {lastConvId && (
            <Button variant="outline" size="sm" onClick={debugLastCall} disabled={debugging} title={`Conversation ${lastConvId}`}>
              {debugging ? <Loader2 className="size-3.5 animate-spin" /> : <Bug className="size-3.5" />}
              Debug last call
            </Button>
          )}
          <Button
            size="sm"
            onClick={startTestCall}
            disabled={connecting}
            className={cn(isLive && "bg-destructive hover:bg-destructive/90")}
          >
            {connecting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : isLive ? (
              <PhoneOff className="size-3.5" />
            ) : (
              <Phone className="size-3.5" />
            )}
            {isLive ? "End call" : "Get a test call"}
          </Button>
        </div>
      </div>
    </div>
  );
}