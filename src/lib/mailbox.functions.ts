// Live Gmail mailbox: read-only browsing plus one explicit promotion action.
// Nothing here imports mail into the ATS unless the recruiter asks for it.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MailboxAttachment, MailboxListItem, MailboxThreadMessage } from "./mailbox.server";
import type { GridCandidate } from "./mailbox-grid";

export type { MailboxListItem, MailboxThreadMessage, GridCandidate };
export type MailboxAttachmentRef = MailboxAttachment;


async function gmailConnection(userId: string) {
  const { getValidAccessToken } = await import("./google-calendar.server");
  const conn = await getValidAccessToken(userId);
  if (!conn) throw new Error("NOT_CONNECTED");
  if (!conn.scopes?.includes("gmail.readonly")) throw new Error("NO_GMAIL_SCOPE");
  return conn;
}

/** One page of live mailbox messages. Never persisted. */
export const listMailboxMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        /** Gmail label *name* — the `label:` search operator matches names, not ids. */
        label: z.string().max(200).optional(),
        q: z.string().max(500).optional(),
        pageToken: z.string().max(500).nullish(),
        pageSize: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const conn = await gmailConnection(context.userId);
    const { listMessageIds } = await import("./gmail.server");
    const { hydrateListPage } = await import("./mailbox.server");

    const parts: string[] = [];
    if (data.q?.trim()) parts.push(data.q.trim());
    if (data.label && data.label !== "ALL") parts.push(`label:${JSON.stringify(data.label)}`);
    // Spam and trash are never useful recruitment context.
    parts.push("-in:spam", "-in:trash");
    const size = Math.max(10, Math.min(50, data.pageSize ?? 25));

    const page = await listMessageIds(conn.access_token, parts.join(" ").trim(), data.pageToken ?? null, size);
    const messages = await hydrateListPage(conn.access_token, page.messages);

    // Gmail's metadata format omits the MIME tree, so per-message attachment
    // flags would need a full fetch. One extra id-only list with
    // `has:attachment` marks the page cheaply instead.
    let withAttachments = new Set<string>();
    try {
      const att = await listMessageIds(
        conn.access_token,
        [...parts, "has:attachment"].join(" ").trim(),
        null,
        200,
      );
      withAttachments = new Set(att.messages.map((m) => m.id));
    } catch {
      // Non-fatal: the paperclip hint is cosmetic, the thread view is authoritative.
    }

    return {
      email: conn.google_email ?? null,
      messages: messages.map((m) => ({ ...m, hasAttachments: withAttachments.has(m.id) })),
      nextPageToken: page.nextPageToken,
      estimate: page.estimate,
    };
  });

/** Full thread with bodies and attachment metadata — the evidence view. */
export const getMailboxThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const conn = await gmailConnection(context.userId);
    const { loadThread } = await import("./mailbox.server");
    return { messages: await loadThread(conn.access_token, data.threadId) };
  });

/** Base64 bytes of one attachment so the browser can preview or download it. */
export const getMailboxAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        messageId: z.string().min(1).max(200),
        attachmentId: z.string().min(1).max(2000),
        fileName: z.string().max(300).default("attachment"),
        mimeType: z.string().max(200).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const conn = await gmailConnection(context.userId);
    const { getAttachmentBytes } = await import("./gmail.server");
    const bytes = await getAttachmentBytes(conn.access_token, data.messageId, data.attachmentId);
    if (bytes.byteLength > 12 * 1024 * 1024) throw new Error("This attachment is too large to preview here.");
    return {
      fileName: data.fileName,
      mimeType: data.mimeType ?? "application/octet-stream",
      base64: Buffer.from(bytes).toString("base64"),
    };
  });

/**
 * Explicit "Add to Candidates" for a live mailbox message. Reuses the existing
 * classification + dedup pipeline; links to an existing candidate when found.
 */
export const addMailboxMessageToCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ messageId: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const agencyId = (member?.agency_id as string | undefined) ?? null;
    if (!agencyId) throw new Error("You must belong to an agency to add candidates.");

    const conn = await gmailConnection(context.userId);
    const { importMessageAsCandidate } = await import("./mailbox.server");
    return importMessageAsCandidate({
      userId: context.userId,
      agencyId,
      accessToken: conn.access_token,
      googleEmail: conn.google_email ?? null,
      messageId: data.messageId,
    });
  });