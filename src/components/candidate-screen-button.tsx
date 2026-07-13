import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Phone, PhoneOff, Loader2, Sparkles, PhoneCall, Mic } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  startCandidateScreening,
  recordScreeningResult,
} from "@/lib/ai-screener.functions";
import { cn } from "@/lib/utils";

type Props = {
  candidateId: string;
  candidateName: string;
  candidatePhone: string | null;
  positionId: string;
  size?: "sm" | "default";
  onCallLogged?: () => void;
};

/**
 * A candidate row action that triggers an AI screening call.
 * - "Rehearse in browser" always available (uses the recruiter's mic).
 * - "Call candidate" disabled until outbound telephony is wired.
 * When phone is missing, both are disabled with a tooltip.
 */
export function CandidateScreenButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"browser" | "phone">("browser");
  const hasPhone = !!props.candidatePhone?.trim();

  const trigger = (
    <TooltipProvider>
      <Tooltip>
        <Popover>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                size={props.size === "sm" ? "sm" : "default"}
                variant="outline"
                className="gap-1.5"
              >
                <Sparkles className="size-3.5 text-primary" />
                AI Screen
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="end">
            <div className="text-xs text-muted-foreground px-2 py-1.5">
              Automated first-round screening call
            </div>
            <button
              type="button"
              onClick={() => {
                setMode("browser");
                setOpen(true);
              }}
              className="w-full text-left flex items-start gap-2 rounded-md px-2 py-2 hover:bg-secondary"
            >
              <Mic className="size-4 mt-0.5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">Rehearse in browser</div>
                <div className="text-[11px] text-muted-foreground">
                  You talk to the agent as the candidate. No telephony cost.
                </div>
              </div>
            </button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <button
                      type="button"
                      disabled={!hasPhone}
                      onClick={() => {
                        if (!hasPhone) return;
                        setMode("phone");
                        setOpen(true);
                      }}
                      className={cn(
                        "w-full text-left flex items-start gap-2 rounded-md px-2 py-2",
                        hasPhone ? "hover:bg-secondary" : "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <PhoneCall className="size-4 mt-0.5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">Call candidate</div>
                        <div className="text-[11px] text-muted-foreground">
                          {hasPhone ? "Places a real phone call (setup required)." : "Add a phone number first."}
                        </div>
                      </div>
                    </button>
                  </div>
                </TooltipTrigger>
                {!hasPhone && (
                  <TooltipContent side="left">
                    Add a phone number to enable AI calling.
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </PopoverContent>
        </Popover>
        <TooltipContent side="top">automated ai call</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <>
      {trigger}
      {open && (
        <ConversationProvider>
          <ScreeningCallDialog
            {...props}
            mode={mode}
            open={open}
            onClose={() => setOpen(false)}
          />
        </ConversationProvider>
      )}
    </>
  );
}

function ScreeningCallDialog(
  props: Props & { mode: "browser" | "phone"; open: boolean; onClose: () => void },
) {
  const startFn = useServerFn(startCandidateScreening);
  const recordFn = useServerFn(recordScreeningResult);
  const [connecting, setConnecting] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<{
    summary: string | null;
    verdict: string | null;
    durationSec: number | null;
  } | null>(null);
  const pendingContextRef = useRef<string | null>(null);
  const autoRecordedRef = useRef(false);

  const conversation = useConversation({
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : typeof err === "string" ? err : "Call error";
      toast.error(message);
    },
    onConnect: () => {
      try {
        const id = conversation.getId?.();
        if (id) setConversationId(id);
      } catch { /* ignore */ }
    },
    onDisconnect: () => {
      // Auto-fetch transcript after the agent hangs up.
      const id = conversationId ?? (() => { try { return conversation.getId?.() ?? null; } catch { return null; } })();
      if (id && !autoRecordedRef.current) {
        autoRecordedRef.current = true;
        void handleRecord(id);
      }
    },
    onMessage: (msg) => {
      if ((msg as { type?: string }).type === "conversation_initiation_metadata") {
        const ctx = pendingContextRef.current;
        if (ctx) {
          try { conversation.sendContextualUpdate(ctx); } catch { /* ignore */ }
          pendingContextRef.current = null;
        }
      }
    },
  });

  const status = conversation.status;
  const isLive = status === "connected";

  useEffect(() => {
    // Kick off the call as soon as the dialog opens.
    if (!props.open) return;
    if (props.mode !== "browser") return;
    if (isLive || connecting) return;
    void startCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  async function startCall() {
    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const t = await startFn({
        data: {
          candidateId: props.candidateId,
          positionId: props.positionId,
          mode: props.mode,
        },
      });
      pendingContextRef.current = [
        `Role brief for this call:`,
        t.systemPrompt,
        ``,
        `Suggested opening line: ${t.firstMessage}`,
      ].join("\n");
      await conversation.startSession({
        conversationToken: t.token,
        connectionType: "webrtc",
        dynamicVariables: t.dynamicVariables,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start call");
      props.onClose();
    } finally {
      setConnecting(false);
    }
  }

  async function endCall() {
    try { await conversation.endSession(); } catch { /* ignore */ }
  }

  async function handleRecord(id: string) {
    setRecording(true);
    try {
      const r = await recordFn({
        data: {
          conversationId: id,
          candidateId: props.candidateId,
          positionId: props.positionId,
          mode: props.mode,
        },
      });
      setResult({ summary: r.summary, verdict: r.verdict, durationSec: r.durationSec });
      props.onCallLogged?.();
      toast.success("Call transcript saved to candidate.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save transcript");
    } finally {
      setRecording(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={(v) => { if (!v) { void endCall(); props.onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI screening — {props.candidateName}
          </DialogTitle>
          <DialogDescription>
            {props.mode === "browser"
              ? "You'll speak with the AI agent through your mic as if you were the candidate. Hang up when done — the transcript will be saved."
              : "Placing an outbound call to the candidate."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-secondary/30 p-4 min-h-24 flex items-center justify-center text-sm">
          {result ? (
            <div className="space-y-2 w-full">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Summary</span>
                {result.verdict && (
                  <span className={cn(
                    "text-[10px] uppercase px-2 py-0.5 rounded-full",
                    result.verdict === "pass" && "bg-success/15 text-success",
                    result.verdict === "fail" && "bg-destructive/15 text-destructive",
                    result.verdict === "unclear" && "bg-warning/15 text-warning",
                  )}>
                    {result.verdict}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {result.summary || "No summary was generated for this call."}
              </p>
              <p className="text-[11px] text-muted-foreground">Duration: {result.durationSec ?? 0}s</p>
            </div>
          ) : recording ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Fetching transcript…
            </span>
          ) : isLive ? (
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-success animate-pulse" />
              {conversation.isSpeaking ? "Agent speaking…" : "Listening — speak to the agent."}
            </span>
          ) : connecting || status === "connecting" ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Connecting…
            </span>
          ) : (
            <span className="text-muted-foreground">Preparing call…</span>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isLive ? (
            <Button variant="destructive" onClick={endCall} className="gap-1.5">
              <PhoneOff className="size-4" /> End call
            </Button>
          ) : result ? (
            <Button onClick={props.onClose}>Done</Button>
          ) : (
            <Button variant="outline" onClick={() => { void endCall(); props.onClose(); }} disabled={recording}>
              {recording ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />} Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}