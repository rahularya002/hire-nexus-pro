// Live mailbox helpers. Browsing never writes to the ATS; only the explicit
// "Add to candidates" action goes through the existing import pipeline.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  attachmentNames,
  findAllAttachments,
  getAttachmentBytes,
  getBodyText,
  getMessage,
  getMessageMeta,
  getThread,
  header,
  parseAddress,
  parseAddressList,
} from "./gmail.server";
import { gmailMessageToRawItem } from "./gmail-discovery.server";
import { classifyItem } from "./pipeline/classify.server";
import { cleanBodyText, extractDeterministic, sha256Bytes } from "./pipeline/normalize.server";
import { emptyMetrics } from "./pipeline/types";
import { upsertPersonFromPayload, type CandidatePayload, type StoredAttachment } from "./email-import.server";

export type MailboxAttachment = {
  attachmentId: string;
  fileName: string;
  mimeType: string | null;
  size: number;
};

export type MailboxListItem = {
  id: string;
  threadId: string;
  subject: string | null;
  fromName: string | null;
  fromEmail: string | null;
  toEmails: string[];
  snippet: string | null;
  sentAt: string | null;
  unread: boolean;
  labelIds: string[];
  attachments: MailboxAttachment[];
  /** File names present on the message, even when ids are unavailable (list view). */
  attachmentNames: string[];
  /** List-view hint: Gmail reports this message as carrying an attachment. */
  hasAttachments?: boolean;
};

export type MailboxThreadMessage = MailboxListItem & { bodyText: string };

function sentAtOf(msg: Parameters<typeof gmailMessageToRawItem>[0]): string | null {
  const dateHeader = header(msg, "Date");
  if (msg.internalDate) return new Date(Number(msg.internalDate)).toISOString();
  if (!dateHeader) return null;
  const d = new Date(dateHeader);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toListItem(msg: Parameters<typeof gmailMessageToRawItem>[0]): MailboxListItem {
  const from = parseAddress(header(msg, "From"));
  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: header(msg, "Subject"),
    fromName: from.name,
    fromEmail: from.email,
    toEmails: parseAddressList(header(msg, "To")),
    snippet: msg.snippet ?? null,
    sentAt: sentAtOf(msg),
    unread: (msg.labelIds ?? []).includes("UNREAD"),
    labelIds: msg.labelIds ?? [],
    attachments: findAllAttachments(msg).map((a) => ({
      attachmentId: a.attachmentId,
      fileName: a.filename,
      mimeType: a.mimeType,
      size: a.size,
    })),
    attachmentNames: attachmentNames(msg),
  };
}

/** Metadata for a page of message ids, fetched with bounded concurrency. */
export async function hydrateListPage(
  accessToken: string,
  ids: { id: string; threadId: string }[],
): Promise<MailboxListItem[]> {
  const out: (MailboxListItem | null)[] = new Array(ids.length).fill(null);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(8, ids.length)) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= ids.length) return;
        try {
          const msg = await getMessageMeta(accessToken, ids[i]!.id);
          out[i] = toListItem(msg);
        } catch {
          out[i] = null;
        }
      }
    }),
  );
  return out.filter((m): m is MailboxListItem => !!m);
}

export async function loadThread(accessToken: string, threadId: string): Promise<MailboxThreadMessage[]> {
  const thread = await getThread(accessToken, threadId);
  return (thread.messages ?? []).map((m) => ({ ...toListItem(m), bodyText: getBodyText(m, 20_000) }));
}

/**
 * Explicit promotion of one live mailbox message: classify it with the existing
 * pipeline, store the resume, upsert the archive person, then create/link the
 * permanent candidate record (deduped on email).
 */
export async function importMessageAsCandidate(args: {
  userId: string;
  agencyId: string;
  accessToken: string;
  googleEmail: string | null;
  messageId: string;
}): Promise<{ personId: string; candidateId: string; alreadyExisted: boolean; name: string }> {
  const metrics = emptyMetrics();

  // Idempotent: a second click (or a retry) on the same message links to the
  // record we already created instead of downloading and classifying again.
  const { data: prior } = await supabaseAdmin
    .from("email_messages")
    .select("email_candidate_id, email_candidates!inner(id,name,promoted_candidate_id)")
    .eq("user_id", args.userId)
    .eq("gmail_message_id", args.messageId)
    .not("email_candidate_id", "is", null)
    .limit(1)
    .maybeSingle();
  const priorPerson = (prior as { email_candidates?: { id: string; name: string; promoted_candidate_id: string | null } } | null)
    ?.email_candidates;
  if (priorPerson?.promoted_candidate_id) {
    return {
      personId: priorPerson.id,
      candidateId: priorPerson.promoted_candidate_id,
      alreadyExisted: true,
      name: priorPerson.name ?? "This candidate",
    };
  }

  const msg = await getMessage(args.accessToken, args.messageId);
  const raw = gmailMessageToRawItem(msg, msg.threadId ?? null);
  const bodyText = cleanBodyText(raw.bodyText);
  const mine = (args.googleEmail ?? "").toLowerCase() || null;

  const primary = raw.attachments[0] ?? null;
  let docText = "";
  let bytes: Uint8Array | null = null;
  let hash: string | null = null;
  if (primary) {
    try {
      bytes = await getAttachmentBytes(args.accessToken, args.messageId, primary.externalId);
      hash = await sha256Bytes(bytes);
      const { data: known } = await supabaseAdmin
        .from("email_resume_versions")
        .select("extracted_text")
        .eq("user_id", args.userId)
        .eq("content_sha256", hash)
        .not("extracted_text", "is", null)
        .limit(1)
        .maybeSingle();
      if (known?.extracted_text) {
        docText = known.extracted_text as string;
      } else {
        const { extractCvText } = await import("./cv-parse.server");
        docText = await extractCvText(bytes, primary.fileName, primary.mimeType);
      }
    } catch {
      docText = "";
    }
  }

  const signal = {
    fromEmail: raw.fromEmail,
    fromName: raw.fromName,
    toEmails: raw.toEmails,
    myEmail: mine,
    subject: raw.subject,
    bodyText,
    attachmentNames: raw.attachments.map((a) => a.fileName),
    docText,
    threadKnown: false,
  };
  const det = extractDeterministic({
    fromEmail: raw.fromEmail,
    fromName: raw.fromName,
    cleanBody: bodyText,
    docText,
    primaryFileName: primary?.fileName ?? null,
  });
  const cls = await classifyItem({
    userId: args.userId,
    signal,
    deterministic: det.fields,
    gaps: det.gaps,
    attachmentHashes: hash ? [hash] : [],
    metrics,
  });

  const stored: StoredAttachment[] = [];
  if (primary && bytes) {
    const safe = primary.fileName.replace(/[^\w.\-]+/g, "_");
    const path = `email-archive/${args.userId}/${args.messageId}-${safe}`;
    try {
      const up = await supabaseAdmin.storage
        .from("documents")
        .upload(path, bytes, { upsert: true, contentType: primary.mimeType ?? undefined });
      if (up.error) throw new Error(up.error.message);
      stored.push({
        path,
        file_name: primary.fileName,
        mime: primary.mimeType,
        size: primary.size,
        content_sha256: hash,
        extracted_text: docText,
      });
    } catch {
      /* candidate still importable without the stored file */
    }
  }

  const payload: CandidatePayload = {
    agency_id: args.agencyId,
    user_id: args.userId,
    gmail_message_id: args.messageId,
    gmail_thread_id: msg.threadId ?? null,
    subject: raw.subject,
    snippet: msg.snippet ?? null,
    from_email: raw.fromEmail,
    from_name: raw.fromName,
    to_emails: raw.toEmails,
    direction: raw.fromEmail && mine && raw.fromEmail === mine ? "outbound" : "inbound",
    sent_at: raw.sentAt,
    confidence: cls.confidence,
    email_kind: cls.kind,
    artifact_type: cls.artifact,
    reason: cls.reason,
    signals: cls.signals,
    extracted: cls.extracted,
    attachments: stored,
    body_text: bodyText,
  };

  const person = await upsertPersonFromPayload(payload);
  const res = await promotePerson(person.personId, args.userId);
  return { personId: person.personId, candidateId: res.candidateId, alreadyExisted: res.alreadyExisted, name: person.name };
}

/** Link the archive person to a candidate record (race-safe, dedup on email). */
export async function promotePerson(
  personId: string,
  userId: string,
): Promise<{ candidateId: string; alreadyExisted: boolean }> {
  const { linkOrCreateCandidate } = await import("./candidate-promote.server");
  return linkOrCreateCandidate(personId, userId);
}
