import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Paperclip, Send, X, FileText, Image as ImageIcon, FileSpreadsheet, File as FileIcon, Download, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ChatAttachment, type ChatChannel, type ChatParty,
  attachFiles, dayLabel, formatBytes, formatTime, getMessages, markRead, sendMessage, subscribe,
} from "@/lib/chat-data";

function useChatMessages(channelId: string) {
  return useSyncExternalStore(
    (cb) => subscribe(cb),
    () => getMessages(channelId),
    () => getMessages(channelId),
  );
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.includes("pdf")) return FileText;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return FileSpreadsheet;
  return FileIcon;
}

export function ChatThread({
  channel,
  viewer,
  authorName,
  initials,
  onAfterSend,
  className,
}: {
  channel: ChatChannel;
  viewer: ChatParty;
  authorName: string;
  initials: string;
  onAfterSend?: () => void;
  className?: string;
}) {
  const messages = useChatMessages(channel.id);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { markRead(channel.id, viewer); }, [channel.id, viewer, messages.length]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const submit = () => {
    const body = draft.trim();
    if (!body && pending.length === 0) return;
    sendMessage(channel.id, { from: viewer, authorName, initials, body, attachments: pending });
    setDraft(""); setPending([]); onAfterSend?.();
  };

  const onPickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPending((prev) => [...prev, ...attachFiles(files)]);
  };

  const otherName = viewer === "client" ? channel.agencyOwnerName : channel.clientName;
  const otherSubtitle = viewer === "client"
    ? "TalentFlow · Account Lead"
    : `${channel.agencyOwnerName} · Account Lead`;

  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-card overflow-hidden", className)} style={{ minHeight: 560 }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <div
          className="size-10 rounded-full grid place-items-center text-xs font-semibold text-primary-foreground"
          style={{ background: viewer === "client" ? "linear-gradient(135deg, var(--primary), var(--purple, oklch(0.62 0.20 295)))" : channel.clientColor }}
        >
          {viewer === "client" ? channel.agencyOwnerInitials : channel.clientInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{otherName}</span>
            <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium",
              channel.agencyOnline ? "text-success" : "text-muted-foreground")}>
              <CircleDot className="size-3" /> {channel.agencyOnline ? "Online" : "Away"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground truncate">{otherSubtitle}</div>
        </div>
        <div className="text-[11px] text-muted-foreground hidden sm:block">Typically replies within 2 hrs</div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-secondary/20">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">No messages yet — say hello.</div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDay = !prev || dayLabel(prev.sentAt) !== dayLabel(m.sentAt);
            const grouped = prev && prev.from === m.from && prev.authorName === m.authorName && (m.sentAt - prev.sentAt) < 5 * 60 * 1000 && !showDay;
            const mine = m.from === viewer;
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{dayLabel(m.sentAt)}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <div className={cn("flex gap-3", mine && "flex-row-reverse", grouped && "mt-0.5")}>
                  {!grouped ? (
                    <div className={cn("size-9 shrink-0 rounded-full grid place-items-center text-[11px] font-semibold text-primary-foreground",
                      mine ? "bg-primary" : "bg-gradient-to-br from-purple to-primary")}>
                      {m.initials}
                    </div>
                  ) : (
                    <div className="size-9 shrink-0" />
                  )}
                  <div className={cn("max-w-[75%] min-w-0 flex flex-col", mine && "items-end")}>
                    {!grouped && (
                      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground mb-1", mine && "flex-row-reverse")}>
                        <span className="font-medium text-foreground">{m.authorName}</span>
                        <span>·</span>
                        <span>{formatTime(m.sentAt)}</span>
                      </div>
                    )}
                    {m.body && (
                      <div className={cn("rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
                        mine ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm")}>
                        {m.body}
                      </div>
                    )}
                    {m.attachments.length > 0 && (
                      <div className={cn("mt-2 grid gap-2 w-full", mine ? "justify-items-end" : "justify-items-start")}>
                        {m.attachments.map((a) => {
                          const Icon = fileIcon(a.mime);
                          return (
                            <a
                              key={a.id}
                              href={a.url} download={a.name}
                              className={cn("inline-flex items-center gap-3 rounded-lg border px-3 py-2 text-xs transition hover:shadow-sm max-w-full",
                                mine ? "bg-primary/10 border-primary/30" : "bg-card border-border")}
                            >
                              <div className={cn("size-9 shrink-0 rounded-md grid place-items-center",
                                mine ? "bg-primary/20 text-primary" : "bg-secondary text-foreground")}>
                                <Icon className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate max-w-[200px]">{a.name}</div>
                                <div className="text-muted-foreground text-[11px]">{formatBytes(a.sizeBytes)} · {a.mime.split("/")[1] || "file"}</div>
                              </div>
                              <Download className="size-3.5 text-muted-foreground shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Pending attachments */}
      {pending.length > 0 && (
        <div className="px-4 pt-3 border-t border-border bg-card flex flex-wrap gap-2">
          {pending.map((a) => {
            const Icon = fileIcon(a.mime);
            return (
              <div key={a.id} className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/60 pl-2 pr-1 py-1 text-xs">
                <Icon className="size-3.5 text-muted-foreground" />
                <span className="font-medium truncate max-w-[160px]">{a.name}</span>
                <span className="text-muted-foreground">{formatBytes(a.sizeBytes)}</span>
                <button onClick={() => setPending((prev) => prev.filter((x) => x.id !== a.id))}
                  className="size-5 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive">
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Composer */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-end gap-2">
          <input
            ref={fileInput} type="file" multiple className="hidden"
            onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="size-10 grid place-items-center rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition"
            title="Attach files"
          >
            <Paperclip className="size-4" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={(e) => { if (e.clipboardData?.files?.length) { e.preventDefault(); onPickFiles(e.clipboardData.files); } }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={2}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={submit}
            disabled={!draft.trim() && pending.length === 0}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            <Send className="size-4" /> Send
          </button>
        </div>
      </div>
    </div>
  );
}