// Live Gmail mailbox, recruitment-focused. These messages are NOT in the ATS —
// only the explicit "Add to candidates" action creates a record.
import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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

const COLUMNS: { key: keyof GridCandidate | "actions"; label: string; width: string }[] = [
  { key: "name", label: "Candidate Name", width: "min-w-[13rem]" },
  { key: "phone", label: "Contact No", width: "min-w-[9rem]" },
  { key: "email", label: "Email", width: "min-w-[14rem]" },
  { key: "role", label: "Designation", width: "min-w-[11rem]" },
  { key: "skills", label: "Skill", width: "min-w-[15rem]" },
  { key: "experience", label: "Experience", width: "min-w-[8rem]" },
  { key: "company", label: "Organisation", width: "min-w-[11rem]" },
  { key: "currentCtc", label: "Current CTC", width: "min-w-[8rem]" },
  { key: "expectedCtc", label: "Expected CTC", width: "min-w-[8rem]" },
  { key: "noticePeriod", label: "Notice Period", width: "min-w-[8rem]" },
  { key: "location", label: "Current Location", width: "min-w-[10rem]" },
  { key: "actions", label: "Source", width: "min-w-[11rem]" },
];

/** Missing data is always shown as missing — never guessed. */
function Cell({ value }: { value: string | null | undefined }) {
  return value && value.trim() ? (
    <span className="text-foreground">{value}</span>
  ) : (
    <span className="text-muted-foreground/60">–</span>
  );
}

function SkillCell({ skills }: { skills: string[] }) {
  if (!skills.length) return <span className="text-muted-foreground/60">–</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {skills.slice(0, 4).map((s) => (
        <span key={s} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
          {s}
        </span>
      ))}
      {skills.length > 4 && <span className="text-[10px] text-muted-foreground/70">+{skills.length - 4}</span>}
    </div>
  );
}

function GridSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-border">
          {COLUMNS.map((c) => (
            <td key={String(c.key)} className="px-3 py-3">
              <div className="h-3 rounded bg-secondary animate-pulse" style={{ width: `${50 + ((r * 13 + c.label.length * 7) % 40)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function MailboxPanel({ authed, gmailReady, labels, onConnect }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMailboxCandidates);
  const addFn = useServerFn(addMailboxMessageToCandidates);
  const openAttachment = useAttachmentOpener();

  const [scope, setScope] = useState<string>("recruitment");
  const [labelName, setLabelName] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [sourcesFor, setSourcesFor] = useState<GridCandidate | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const scopeQuery = QUICK_SCOPES.find((s) => s.key === scope)?.q ?? "";
  const browsable = authed && gmailReady;

  const list = useInfiniteQuery({
    queryKey: ["mailbox-candidates", scope, labelName],
    enabled: browsable,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      listFn({ data: { q: scopeQuery || undefined, label: labelName, pageToken: pageParam, pageSize: 12 } }),
    getNextPageParam: (last) => last.nextPageToken ?? undefined,
  });

  // Candidates can appear in more than one page of mail, so merge across pages too.
  const candidates = useMemo(
    () => mergeCandidateRows((list.data?.pages ?? []).flatMap((p) => p.candidates as GridCandidate[])),
    [list.data],
  );
  const rows = useMemo(() => candidates.filter((c) => matchesGridQuery(c, query)), [candidates, query]);
  const scanned = useMemo(
    () => (list.data?.pages ?? []).reduce((n, p) => n + (p.scanned ?? 0), 0),
    [list.data],
  );

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
        title="Connect Gmail to build your candidate grid"
        description="Your mail stays in Gmail. TalentFlow reads it read-only, extracts candidate details from recruitment emails and their attached CVs, and lists them here."
        action={<Button onClick={onConnect}>Connect Gmail</Button>}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground inline-flex items-start gap-1.5 max-w-2xl leading-relaxed">
          <Mail className="size-3.5 mt-0.5 shrink-0" />
          <span>
            Candidates are extracted automatically from your connected recruitment emails and attached CVs. Review
            them here and add anyone you want to your main talent database.
            {list.data?.pages?.[0]?.email ? ` · ${list.data.pages[0].email}` : ""}
          </span>
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
          <div className="min-w-[11rem]">
            <Select value={labelName} onValueChange={setLabelName}>
              <SelectTrigger className="h-8 w-full rounded-full border-border bg-background px-3 text-xs text-muted-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className="max-h-64 rounded-xl border-border bg-popover text-popover-foreground"
                position="popper"
                sideOffset={4}
              >
                <SelectItem value="ALL" className="rounded-md py-1.5 text-xs data-[highlighted]:bg-primary/15 data-[highlighted]:text-primary">
                  All labels
                </SelectItem>
                {labels.map((l) => (
                  <SelectItem
                    key={l.id}
                    value={l.name}
                    className="rounded-md py-1.5 text-xs data-[highlighted]:bg-primary/15 data-[highlighted]:text-primary"
                  >
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="relative min-w-[14rem] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter candidates by name, skill, company, location…"
            className="h-8 rounded-full pl-9 text-xs"
          />
        </div>
      </div>

      {list.isError && !list.isLoading ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="size-4 mt-0.5" />
          <div className="space-y-2">
            <p>{friendlyError(list.error)}</p>
            <Button size="sm" variant="outline" onClick={onConnect}>
              Reconnect Gmail
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="max-h-[68vh] overflow-auto">
              <table className="w-full text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-secondary/60 backdrop-blur">
                    {COLUMNS.map((c) => (
                      <th
                        key={String(c.key)}
                        className={`${c.width} whitespace-nowrap border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.isLoading && <GridSkeleton />}
                  {!list.isLoading && rows.length === 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length} className="px-4 py-10">
                        <EmptyState
                          icon={Users}
                          title={query ? "No candidates match this filter" : "No candidates found in this view"}
                          description={
                            query
                              ? "Clear the filter to see every candidate extracted from these emails."
                              : "Try another scope or label, or load more mail — only emails that actually contain a candidate become rows."
                          }
                        />
                      </td>
                    </tr>
                  )}
                  {rows.map((c) => {
                    const src = c.sources[0];
                    return (
                      <tr key={c.key} className="border-t border-border hover:bg-secondary/30 transition-colors">
                        <td className="border-b border-border px-3 py-2.5">
                          <button
                            className="text-left font-medium text-foreground hover:text-primary inline-flex items-center gap-1.5"
                            onClick={() => setSourcesFor(c)}
                          >
                            {c.unread && <Dot className="size-4 text-primary shrink-0" />}
                            {c.name || "Unnamed candidate"}
                          </button>
                          {c.sources.length > 1 && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground">
                              · {c.sources.length} emails
                            </span>
                          )}
                        </td>
                        <td className="border-b border-border px-3 py-2.5 whitespace-nowrap"><Cell value={c.phone} /></td>
                        <td className="border-b border-border px-3 py-2.5"><Cell value={c.email} /></td>
                        <td className="border-b border-border px-3 py-2.5"><Cell value={c.role} /></td>
                        <td className="border-b border-border px-3 py-2.5"><SkillCell skills={c.skills} /></td>
                        <td className="border-b border-border px-3 py-2.5 whitespace-nowrap"><Cell value={c.experience} /></td>
                        <td className="border-b border-border px-3 py-2.5"><Cell value={c.company} /></td>
                        <td className="border-b border-border px-3 py-2.5 whitespace-nowrap"><Cell value={c.currentCtc} /></td>
                        <td className="border-b border-border px-3 py-2.5 whitespace-nowrap"><Cell value={c.expectedCtc} /></td>
                        <td className="border-b border-border px-3 py-2.5 whitespace-nowrap"><Cell value={c.noticePeriod} /></td>
                        <td className="border-b border-border px-3 py-2.5"><Cell value={c.location} /></td>
                        <td className="border-b border-border px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setSourcesFor(c)}>
                              <Mail className="size-3.5" /> Sources
                            </Button>
                            {src && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => add.mutate(src.messageId)}
                                disabled={addingId === src.messageId}
                                title="Add to talent database"
                              >
                                {addingId === src.messageId ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="size-3.5" />
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-muted-foreground">
              {rows.length} candidate{rows.length === 1 ? "" : "s"}
              {scanned ? ` from ${scanned} scanned emails` : ""}
            </p>
            {list.hasNextPage && (
              <Button variant="outline" size="sm" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Scan more emails
              </Button>
            )}
          </div>
        </>
      )}

      {/* Provenance: every source email and attachment behind this row. */}
      <Sheet open={!!sourcesFor} onOpenChange={(o) => !o && setSourcesFor(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="pr-8 text-base">{sourcesFor?.name || "Candidate sources"}</SheetTitle>
          </SheetHeader>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Extracted from {sourcesFor?.sources.length ?? 0} live Gmail message
            {(sourcesFor?.sources.length ?? 0) === 1 ? "" : "s"}.
          </p>
          <div className="mt-4 space-y-3">
            {(sourcesFor?.sources ?? []).map((s) => (
              <article key={s.messageId} className="rounded-xl border border-border bg-card p-3.5 space-y-1.5">
                <div className="text-sm font-medium">{s.subject || "(no subject)"}</div>
                <div className="text-[11px] text-muted-foreground">
                  {s.fromName || s.fromEmail || "Unknown sender"} · {relTime(s.sentAt)}
                </div>
                {s.attachmentNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {s.attachmentNames.map((n) => (
                      <span key={n} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        <Paperclip className="size-3" /> {n}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setThreadId(s.threadId)}>
                    <FileText className="size-3.5" /> Open email
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => add.mutate(s.messageId)}
                    disabled={addingId === s.messageId}
                  >
                    {addingId === s.messageId ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="size-3.5" />
                    )}
                    Add to database
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <ThreadSheet
        threadId={threadId}
        onClose={() => setThreadId(null)}
        onAdd={(id) => add.mutate(id)}
        addingId={addingId}
      />
    </section>
  );
}
