import { useEffect, useMemo, useRef, useState } from "react";
import {
  Paperclip,
  Send,
  X,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  Loader2,
} from "lucide-react";
import { ChatMessagesSkeleton } from "@/components/skeletons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  type Attachment,
  type MessageRow,
  type ThreadRow,
  createSignedAttachmentUrl,
  listMessages,
  markThreadRead,
  sendMessage,
} from "@/lib/messages.functions";

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.includes("pdf")) return FileText;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv"))
    return FileSpreadsheet;
  return FileIcon;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function formatTime(iso: string): string {
  const ms = new Date(iso).getTime();
  const diff = Date.now() - ms;
  const d = new Date(ms);
  if (diff < 60_000) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < DAY) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff < 7 * DAY)
    return (
      d.toLocaleDateString([], { weekday: "short" }) +
      " " +
      d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    );
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - d.getTime()) / DAY);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return new Date(iso).toLocaleDateString([], { weekday: "long" });
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export function DbChatThread({
  thread,
  viewer,
  authorName,
  initials,
  className,
}: {
  thread: ThreadRow;
  viewer: "staff" | "client";
  authorName: string;
  initials: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendMessage);
  const markFn = useServerFn(markThreadRead);
  const signFn = useServerFn(createSignedAttachmentUrl);

  const messagesQ = useQuery({
    queryKey: ["messages", thread.id],
    queryFn: () => listFn({ data: { threadId: thread.id } }),
    refetchInterval: 5000,
  });

  const messages = useMemo<MessageRow[]>(() => messagesQ.data ?? [], [messagesQ.data]);

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (messages.length === 0) return;
    markFn({ data: { threadId: thread.id, viewer } }).then(() => {
      qc.invalidateQueries({ queryKey: ["threads"] });
    });
  }, [thread.id, viewer, messages.length, markFn, qc]);

  const sendMut = useMutation({
    mutationFn: async () => {
      const body = draft.trim();
      if (!body && pending.length === 0) return;
      await sendFn({
        data: {
          threadId: thread.id,
          body,
          attachments: pending,
          senderRole: viewer,
          authorName,
          initials,
        },
      });
    },
    onSuccess: () => {
      setDraft("");
      setPending([]);
      qc.invalidateQueries({ queryKey: ["messages", thread.id] });
      qc.invalidateQueries({ queryKey: ["threads"] });
    },
  });

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploads: Attachment[] = [];
      for (const f of Array.from(files)) {
        const safe = f.name.replace(/[^\w.\-]+/g, "_");
        const path = `${thread.client_id}/${thread.id}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage
          .from("chat-attachments")
          .upload(path, f, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        uploads.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: f.name,
          sizeBytes: f.size,
          mime: f.type || "application/octet-stream",
          bucket: "chat-attachments",
          path,
        });
      }
      setPending((prev) => [...prev, ...uploads]);
    } catch (e) {
      console.error("upload failed", e);
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function openAttachment(a: Attachment) {
    try {
      const { url } = await signFn({
        data: { bucket: a.bucket, path: a.path, expiresIn: 300 },
      });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      console.error(e);
      alert("Could not open attachment.");
    }
  }

  const otherName =
    viewer === "client"
      ? "TalentFlow team"
      : thread.client?.contact_name ?? thread.client?.name ?? "Client";
  const otherSubtitle =
    viewer === "client"
      ? "TalentFlow · Account Lead"
      : `${thread.client?.name ?? "Client"} · Account`;
  const avatarBg =
    viewer === "client"
      ? "linear-gradient(135deg, var(--primary), var(--purple, oklch(0.62 0.20 295)))"
      : thread.client?.color ?? "var(--primary)";
  const avatarInitials =
    viewer === "client" ? "TF" : (thread.client?.name ?? "C").slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card overflow-hidden",
        className,
      )}
      style={{ minHeight: 560 }}
    >
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <div
          className="size-10 rounded-full grid place-items-center text-xs font-semibold text-primary-foreground"
          style={{ background: avatarBg }}
        >
          {avatarInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{otherName}</div>
          <div className="text-xs text-muted-foreground truncate">{otherSubtitle}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-secondary/20">
        {messagesQ.isLoading ? (
          <ChatMessagesSkeleton rows={5} />
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">
            No messages yet — say hello.
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
            const grouped =
              prev &&
              prev.sender_role === m.sender_role &&
              prev.author_name === m.author_name &&
              new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() <
                5 * 60 * 1000 &&
              !showDay;
            const mine = m.sender_role === viewer;
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      {dayLabel(m.created_at)}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <div className={cn("flex gap-3", mine && "flex-row-reverse", grouped && "mt-0.5")}>
                  {!grouped ? (
                    <div
                      className={cn(
                        "size-9 shrink-0 rounded-full grid place-items-center text-[11px] font-semibold text-primary-foreground",
                        mine ? "bg-primary" : "bg-gradient-to-br from-purple to-primary",
                      )}
                    >
                      {m.initials}
                    </div>
                  ) : (
                    <div className="size-9 shrink-0" />
                  )}
                  <div className={cn("max-w-[75%] min-w-0 flex flex-col", mine && "items-end")}>
                    {!grouped && (
                      <div
                        className={cn(
                          "flex items-center gap-2 text-xs text-muted-foreground mb-1",
                          mine && "flex-row-reverse",
                        )}
                      >
                        <span className="font-medium text-foreground">{m.author_name}</span>
                        <span>·</span>
                        <span>{formatTime(m.created_at)}</span>
                      </div>
                    )}
                    {m.body && (
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
                          mine
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-card border border-border rounded-tl-sm",
                        )}
                      >
                        {m.body}
                      </div>
                    )}
                    {m.attachments.length > 0 && (
                      <div
                        className={cn(
                          "mt-2 grid gap-2 w-full",
                          mine ? "justify-items-end" : "justify-items-start",
                        )}
                      >
                        {m.attachments.map((a) => {
                          const Icon = fileIcon(a.mime);
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => openAttachment(a)}
                              className={cn(
                                "inline-flex items-center gap-3 rounded-lg border px-3 py-2 text-xs transition hover:shadow-sm max-w-full",
                                mine ? "bg-primary/10 border-primary/30" : "bg-card border-border",
                              )}
                            >
                              <div
                                className={cn(
                                  "size-9 shrink-0 rounded-md grid place-items-center",
                                  mine
                                    ? "bg-primary/20 text-primary"
                                    : "bg-secondary text-foreground",
                                )}
                              >
                                <Icon className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1 text-left">
                                <div className="font-medium truncate max-w-[200px]">{a.name}</div>
                                <div className="text-muted-foreground text-[11px]">
                                  {formatBytes(a.sizeBytes)} · {a.mime.split("/")[1] || "file"}
                                </div>
                              </div>
                              <Download className="size-3.5 text-muted-foreground shrink-0" />
                            </button>
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

      {pending.length > 0 && (
        <div className="px-4 pt-3 border-t border-border bg-card flex flex-wrap gap-2">
          {pending.map((a) => {
            const Icon = fileIcon(a.mime);
            return (
              <div
                key={a.id}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/60 pl-2 pr-1 py-1 text-xs"
              >
                <Icon className="size-3.5 text-muted-foreground" />
                <span className="font-medium truncate max-w-[160px]">{a.name}</span>
                <span className="text-muted-foreground">{formatBytes(a.sizeBytes)}</span>
                <button
                  onClick={() => setPending((prev) => prev.filter((x) => x.id !== a.id))}
                  className="size-5 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-end gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              onPickFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="size-10 grid place-items-center rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition disabled:opacity-50"
            title="Attach files"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMut.mutate();
              }
            }}
            rows={2}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={() => sendMut.mutate()}
            disabled={(!draft.trim() && pending.length === 0) || sendMut.isPending}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {sendMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}