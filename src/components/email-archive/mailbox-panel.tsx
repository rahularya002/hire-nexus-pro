// Live Gmail mailbox, recruitment-focused. These messages are NOT in the ATS —
// only the explicit "Add to candidates" action creates a record.
import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Dot,
  FileText,
  Inbox,
  Loader2,
  Mail,
  Paperclip,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { relTime } from "@/components/email-archive/shared";
import {
  addMailboxMessageToCandidates,
  getMailboxAttachment,
  getMailboxThread,
  listMailboxMessages,
  type MailboxAttachmentRef,
} from "@/lib/mailbox.functions";

type Props = {
  authed: boolean;
  gmailReady: boolean;
  labels: { id: string; name: string }[];
  onConnect: () => void;
};

/**
 * Renders a plain-text email body the way a mail client does: paragraphs are
 * blocks with modest spacing, single newlines stay soft wraps, and runs of blank
 * lines collapse so HTML-to-text conversion doesn't double-space the message.
 * Quoted reply lines ("> ...") keep their own indented block.
 */
function EmailBody({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const normalized = text
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{2,}/g, "\n\n")
      .trim();
    return normalized
      .split("\n\n")
      .map((b) => b.replace(/\n{2,}/g, "\n").trim())
      .filter(Boolean);
  }, [text]);

  if (blocks.length === 0) return <p className="text-xs text-muted-foreground">(no text content)</p>;

  return (
    <div className="text-xs leading-relaxed text-muted-foreground">
      {blocks.map((b, i) => {
        const quoted = /^\s*>/.test(b);
        return (
          <p
            key={i}
            className={
              quoted
                ? "whitespace-pre-wrap break-words border-l-2 border-border pl-3 text-muted-foreground/80 mt-2 first:mt-0"
                : "whitespace-pre-wrap break-words mt-2 first:mt-0"
            }
          >
            {quoted ? b.replace(/^[ \t]*>[ \t]?/gm, "") : b}
          </p>
        );
      })}
    </div>
  );
}

const QUICK_SCOPES = [
  { key: "recruitment", label: "Recruitment mail", q: "(resume OR cv OR candidate OR hiring OR interview OR opening)" },
  { key: "resumes", label: "With resumes", q: "has:attachment (filename:pdf OR filename:doc OR filename:docx)" },
  { key: "unread", label: "Unread", q: "is:unread" },
  { key: "all", label: "All mail", q: "" },
] as const;

function friendlyError(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("NOT_CONNECTED")) return "Connect your Google account to open your mailbox.";
  if (m.includes("NO_GMAIL_SCOPE") || m.includes("GMAIL_SCOPE")) {
    return "Reconnect Google and grant read-only Gmail access.";
  }
  if (m.includes("GMAIL_AUTH")) return "Gmail rejected the request — reconnect your Google account.";
  if (m.includes("GMAIL_RATE_LIMIT")) return "Gmail is rate limiting us right now — try again in a moment.";
  if (m.includes("GMAIL_UNAVAILABLE")) return "Gmail is temporarily unavailable — try again in a moment.";
  if (m.includes("GMAIL_NOT_FOUND")) return "That message is no longer in the mailbox.";
  if (m.includes("reconnect") || m.includes("Reconnect")) return m;
  return m;
}

function useAttachmentOpener() {
  const attFn = useServerFn(getMailboxAttachment);
  return async (messageId: string, att: MailboxAttachmentRef) => {
    try {
      const res = await attFn({
        data: {
          messageId,
          attachmentId: att.attachmentId,
          fileName: att.fileName,
          mimeType: att.mimeType,
        },
      });
      const bin = atob(res.base64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([buf], { type: res.mimeType }));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };
}

/** Shared evidence view: also used by the search results panel. */
export function ThreadSheet({
  threadId,
  onClose,
  onAdd,
  addingId,
}: {
  threadId: string | null;
  onClose: () => void;
  onAdd?: (messageId: string) => void;
  addingId?: string | null;
}) {
  const threadFn = useServerFn(getMailboxThread);
  const openAttachment = useAttachmentOpener();
  const q = useQuery({
    queryKey: ["mailbox-thread", threadId],
    queryFn: () => threadFn({ data: { threadId: threadId! } }),
    enabled: !!threadId,
  });

  return (
    <Sheet open={!!threadId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-8 text-base">
            {q.data?.messages?.[0]?.subject || "Conversation"}
          </SheetTitle>
        </SheetHeader>

        <p className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
          <Mail className="size-3" /> Live Gmail message — not stored in TalentFlow.
        </p>

        {q.isLoading ? (
          <div className="mt-6 text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading the conversation…
          </div>
        ) : q.isError ? (
          <p className="mt-6 text-sm text-destructive">{friendlyError(q.error)}</p>
        ) : (
          <div className="mt-4 space-y-4">
            {(q.data?.messages ?? []).map((m) => (
              <article key={m.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.fromName || m.fromEmail || "Unknown sender"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.fromEmail} · {relTime(m.sentAt)}
                    </div>
                  </div>
                  {onAdd && (
                    <Button size="sm" variant="outline" onClick={() => onAdd(m.id)} disabled={addingId === m.id}>
                      {addingId === m.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="size-3.5" />
                      )}
                      Add to candidates
                    </Button>
                  )}
                </div>
                {m.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.attachments.map((a) => (
                      <button
                        key={a.attachmentId}
                        onClick={() => openAttachment(m.id, a)}
                        className="text-[11px] inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-primary hover:border-primary/40"
                      >
                        <FileText className="size-3" /> {a.fileName}
                      </button>
                    ))}
                  </div>
                )}
                <EmailBody text={m.bodyText || ""} />
              </article>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function MailboxPanel({ authed, gmailReady, labels, onConnect }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMailboxMessages);
  const addFn = useServerFn(addMailboxMessageToCandidates);
  const openAttachment = useAttachmentOpener();

  const [scope, setScope] = useState<string>("recruitment");
  const [labelName, setLabelName] = useState<string>("ALL");
  const [filter, setFilter] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const scopeQuery = QUICK_SCOPES.find((s) => s.key === scope)?.q ?? "";
  const browsable = authed && gmailReady;

  const list = useInfiniteQuery({
    queryKey: ["mailbox", scope, labelName],
    enabled: browsable,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      listFn({ data: { q: scopeQuery || undefined, label: labelName, pageToken: pageParam, pageSize: 25 } }),
    getNextPageParam: (last) => last.nextPageToken ?? undefined,
  });

  const messages = useMemo(() => {
    const rows = (list.data?.pages ?? []).flatMap((p) => p.messages);
    const term = filter.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((m) =>
      [m.subject, m.fromName, m.fromEmail, m.snippet].some((v) => (v ?? "").toLowerCase().includes(term)),
    );
  }, [list.data, filter]);

  const add = useMutation({
    mutationFn: (messageId: string) => addFn({ data: { messageId } }),
    onMutate: (id) => setAddingId(id),
    onSettled: () => setAddingId(null),
    onSuccess: (r) => {
      toast.success(
        r.alreadyExisted
          ? `${r.name} is already in your candidate database — linked to the existing record.`
          : `${r.name} added to your candidate database.`,
      );
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["email-archive-people"] });
      qc.invalidateQueries({ queryKey: ["email-archive-counts"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  if (!gmailReady) {
    return (
      <EmptyState
        icon={Inbox}
        title="Connect Gmail to open your mailbox"
        description="Your mail stays in Gmail. TalentFlow reads it read-only so you can search your recruitment history and promote the people you want."
        action={<Button onClick={onConnect}>Connect Gmail</Button>}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Mail className="size-3.5" />
          Live Gmail — nothing here is imported into TalentFlow until you add it
          {list.data?.pages?.[0]?.email ? ` · ${list.data.pages[0].email}` : ""}
        </p>
        <Button variant="outline" size="sm" onClick={() => list.refetch()} disabled={list.isFetching}>
          {list.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              scope === s.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
        {labels.length > 0 && (
          <select
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
            className="text-xs h-8 rounded-full border border-border bg-background px-3 text-muted-foreground"
          >
            <option value="ALL">All labels</option>
            {labels.map((l) => (
              <option key={l.id} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter the loaded messages by sender or subject…"
        className="h-9"
      />

      {list.isLoading ? (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Opening your mailbox…
        </div>
      ) : list.isError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="size-4 mt-0.5" />
          <div className="space-y-2">
            <p>{friendlyError(list.error)}</p>
            <Button size="sm" variant="outline" onClick={onConnect}>
              Reconnect Gmail
            </Button>
          </div>
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No messages in this view"
          description="Try a different scope or label, or clear the filter above."
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {messages.map((m) => (
            <div key={m.id} className="flex items-start gap-3 p-3.5 hover:bg-secondary/40 transition-colors">
              <button onClick={() => setThreadId(m.threadId)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5 min-w-0">
                  {m.unread && <Dot className="size-4 text-primary shrink-0" />}
                  <span className={`text-sm truncate ${m.unread ? "font-semibold" : "font-medium"}`}>
                    {m.fromName || m.fromEmail || "Unknown sender"}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0 ml-auto">{relTime(m.sentAt)}</span>
                </div>
                <div className="text-xs truncate mt-0.5">{m.subject || "(no subject)"}</div>
                <div className="text-[11px] text-muted-foreground truncate">{m.snippet}</div>
              </button>

              <div className="shrink-0 flex items-center gap-1.5">
                {m.attachments.length > 0 ? (
                  <button
                    onClick={() => openAttachment(m.id, m.attachments[0]!)}
                    title={m.attachments[0]!.fileName}
                    className="text-muted-foreground hover:text-primary"
                    aria-label="Open attachment"
                  >
                    <Paperclip className="size-3.5" />
                  </button>
                ) : m.attachmentNames.length > 0 || m.hasAttachments ? (
                  <button
                    onClick={() => setThreadId(m.threadId)}
                    title={m.attachmentNames.join(", ") || "Open conversation to view attachments"}
                    className="text-muted-foreground hover:text-primary"
                    aria-label="Open conversation to view attachments"
                  >
                    <Paperclip className="size-3.5" />
                  </button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => add.mutate(m.id)} disabled={addingId === m.id}>
                  {addingId === m.id ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {list.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            {list.isFetchingNextPage ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Load more messages
          </Button>
        </div>
      )}

      <ThreadSheet
        threadId={threadId}
        onClose={() => setThreadId(null)}
        onAdd={(id) => add.mutate(id)}
        addingId={addingId}
      />
    </section>
  );
}